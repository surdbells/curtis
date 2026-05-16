import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';

import { SealService } from '../../core/services/seal.service';
import { ScannerService } from '../../core/services/scanner.service';
import { DayStore } from '../../core/stores/day.store';
import { ConnectivityService } from '../../core/services/connectivity.service';
import { OfflineBannerComponent } from '../../shared/components/offline-banner/offline-banner.component';
import { SealListComponent } from '../../shared/components/seal-list/seal-list.component';
import { ScanButtonComponent } from '../../shared/components/scan-button/scan-button.component';
import type { ScanSession } from '../../core/services/scanner.service';
import type { Seal } from '../../core/models';

/**
 * Route seals scan — Phase 5.
 *
 * Workflow:
 *   1. On entry, GET /GetIncomingSealsByRoute for the active route + user.
 *   2. Render the expected list with pending state.
 *   3. Agent taps "Scan" — continuous scanner opens, agent waves each seal
 *      QR/barcode across, list ticks off in real-time.
 *   4. When all (or as many as possible) are scanned, agent taps Submit —
 *      POST /PostIncomingSealsByRoute with comma-separated scanned IDs.
 *   5. Toast success, navigate back to /dashboard.
 *
 * Matching strategy: a scan is considered a match when the scanned raw
 * value equals any of the seal's `id`, `number`, or `[index signature]`
 * fields. Unknown scans are still recorded — the agent may scan a seal
 * not in the expected list and the backend can reconcile.
 */
@Component({
  selector: 'curtis-route-scan',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule, OfflineBannerComponent, SealListComponent, ScanButtonComponent],
  styles: [
    `
      .summary {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem 1rem;
        background: var(--ion-color-light);
      }
      .summary strong { font-size: 1.1rem; }
      .progress {
        height: 6px;
        background: var(--ion-color-light);
      }
      .progress-bar {
        height: 100%;
        background: var(--ion-color-success);
        transition: width 200ms ease-out;
      }
      .unknown {
        margin: 0.75rem 1rem;
        padding: 0.5rem 0.75rem;
        background: var(--ion-color-warning);
        color: var(--ion-color-warning-contrast);
        border-radius: 8px;
        font-size: 0.8rem;
      }
      .actions { padding: 1rem; display: grid; gap: 0.5rem; }
      .empty {
        text-align: center;
        padding: 2.5rem 1rem;
        color: var(--ion-color-medium);
      }
    `,
  ],
  template: `
    <ion-header translucent>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/dashboard" />
        </ion-buttons>
        <ion-title>Route seals</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <curtis-offline-banner />

      @if (loading()) {
        <div class="empty">
          <ion-spinner name="crescent" />
          <p>Loading expected seals…</p>
        </div>
      } @else if (expected().length === 0) {
        <div class="empty">
          <ion-icon name="checkmark-done-circle-outline" style="font-size: 3rem;" />
          <p>No incoming seals for this route.</p>
        </div>
      } @else {
        <div class="summary">
          <div>
            <strong>{{ scannedCount() }}</strong> / {{ expected().length }} scanned
          </div>
          <ion-chip color="primary">
            <ion-icon name="qr-code-outline" />
            <ion-label>Route</ion-label>
          </ion-chip>
        </div>
        <div class="progress">
          <div class="progress-bar" [style.width.%]="progressPct()"></div>
        </div>

        @if (unknownScans().length > 0) {
          <div class="unknown">
            <ion-icon name="alert-circle-outline" />
            {{ unknownScans().length }} scan(s) didn't match the expected list — still recorded.
          </div>
        }

        <curtis-seal-list [seals]="display()" />

        <div class="actions">
          @if (!scanning()) {
            <curtis-scan-button label="Scan seals" (scan)="startScan()" />
          } @else {
            <ion-button color="medium" expand="block" (click)="stopScan()">
              <ion-icon slot="start" name="close-outline" />
              Stop scanning
            </ion-button>
          }
          <ion-button
            color="tertiary"
            expand="block"
            [disabled]="submitting() || scannedCount() === 0"
            (click)="submit()"
          >
            @if (submitting()) {
              <ion-spinner slot="start" name="crescent" />
              Submitting…
            } @else {
              Submit {{ scannedCount() }} seal(s)
            }
          </ion-button>
        </div>
      }
    </ion-content>
  `,
})
export class RouteScanPage implements OnInit, OnDestroy {
  private readonly seals = inject(SealService);
  private readonly scanner = inject(ScannerService);
  private readonly day = inject(DayStore);
  private readonly connectivity = inject(ConnectivityService);
  private readonly toast = inject(ToastController);
  private readonly router = inject(Router);

  protected readonly expected = signal<Seal[]>([]);
  protected readonly scannedIds = signal<Set<string>>(new Set<string>());
  protected readonly unknownScans = signal<string[]>([]);
  protected readonly loading = signal(false);
  protected readonly scanning = signal(false);
  protected readonly submitting = signal(false);

  private session?: ScanSession;

  protected readonly scannedCount = computed(() => this.scannedIds().size);
  protected readonly progressPct = computed(() => {
    const total = this.expected().length;
    if (total === 0) return 0;
    return Math.min(100, (this.scannedIds().size / total) * 100);
  });

  /** Render the expected list with status='scanned' on matched seals. */
  protected readonly display = computed<Seal[]>(() => {
    const scanned = this.scannedIds();
    return this.expected().map((s) => ({
      ...s,
      status: this.isSealScanned(s, scanned) ? 'scanned' : (s.status ?? 'pending'),
    }));
  });

  async ngOnInit(): Promise<void> {
    const routeId = this.day.routeId();
    if (!routeId) {
      await this.showToast('No active route. Return to dashboard.', 'warning');
      return;
    }
    this.loading.set(true);
    try {
      const list = await firstValueFrom(this.seals.getIncomingByRoute(routeId)).catch(() => []);
      this.expected.set(list ?? []);
    } finally {
      this.loading.set(false);
    }
  }

  async ngOnDestroy(): Promise<void> {
    await this.session?.stop();
    this.session = undefined;
  }

  async startScan(): Promise<void> {
    if (this.scanning()) return;
    this.scanning.set(true);
    try {
      this.session = await this.scanner.startContinuous((value) => this.recordScan(value));
    } catch (err) {
      this.scanning.set(false);
      await this.showToast(this.describeError(err, 'Could not start scanner.'), 'danger');
    }
  }

  async stopScan(): Promise<void> {
    await this.session?.stop();
    this.session = undefined;
    this.scanning.set(false);
  }

  /** Try to match a scanned value to an expected seal; record either way. */
  private recordScan(raw: string): void {
    const match = this.findMatch(raw);
    if (match) {
      this.scannedIds.update((s) => new Set(s).add(String(match.id)));
    } else {
      this.unknownScans.update((u) => (u.includes(raw) ? u : [...u, raw]));
    }
  }

  private findMatch(raw: string): Seal | null {
    const r = raw.trim();
    return (
      this.expected().find((s) => {
        const id = String(s.id ?? '');
        const num = String(s.number ?? '');
        return id === r || num === r;
      }) ?? null
    );
  }

  private isSealScanned(s: Seal, scanned: Set<string>): boolean {
    return scanned.has(String(s.id));
  }

  async submit(): Promise<void> {
    if (this.submitting() || this.scannedCount() === 0) return;
    if (!this.connectivity.online()) {
      await this.showToast('Offline — submission will sync when connection returns.', 'warning');
    }
    await this.stopScan();
    this.submitting.set(true);
    try {
      const ids = Array.from(this.scannedIds());
      // Also append any unknown raw scans so the backend can audit them.
      const allIds = ids.concat(this.unknownScans());
      await this.seals.postIncomingByRoute({ sealIds: allIds });
      await this.showToast('Seals submitted.', 'success');
      await this.router.navigateByUrl('/dashboard', { replaceUrl: true });
    } catch (err) {
      await this.showToast(this.describeError(err, 'Submission failed.'), 'danger');
    } finally {
      this.submitting.set(false);
    }
  }

  private describeError(err: unknown, fallback: string): string {
    if (err && typeof err === 'object') {
      const e = err as { message?: string };
      if (typeof e.message === 'string' && e.message.trim()) return e.message;
    }
    return fallback;
  }

  private async showToast(message: string, color: 'danger' | 'warning' | 'success') {
    const t = await this.toast.create({
      message,
      duration: 2500,
      position: 'top',
      color,
      buttons: [{ icon: 'close', role: 'cancel' }],
    });
    await t.present();
  }
}
