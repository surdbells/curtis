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
import { CurtisIconComponent } from '../../shared/components/icon';
import { CurtisHeaderComponent } from '../../shared/components/header';
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
  imports: [CommonModule, IonicModule, OfflineBannerComponent, SealListComponent, ScanButtonComponent, CurtisIconComponent, CurtisHeaderComponent],
  styles: [
    `
      :host { display: block; }
      ion-content { --background: var(--curtis-bg); }

      .progress-card {
        margin: var(--curtis-space-3) var(--curtis-space-4);
        padding: var(--curtis-space-4);
        background: var(--curtis-surface-1);
        border: 1px solid var(--curtis-border);
        border-radius: var(--curtis-radius-lg);
        box-shadow: var(--curtis-shadow-xs);
      }
      .progress-card__head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: var(--curtis-space-3);
      }
      .progress-card__label {
        font-size: var(--curtis-text-xs);
        font-weight: var(--curtis-weight-semibold);
        letter-spacing: var(--curtis-tracking-wider);
        text-transform: uppercase;
        color: var(--curtis-text-subtle);
      }
      .progress-card__counter {
        font-size: var(--curtis-text-2xl);
        font-weight: var(--curtis-weight-extrabold);
        font-variant-numeric: tabular-nums;
        color: var(--curtis-text);
        line-height: 1;
      }
      .progress-card__counter .total {
        font-size: var(--curtis-text-base);
        font-weight: var(--curtis-weight-semibold);
        color: var(--curtis-text-muted);
        margin-left: var(--curtis-space-1);
      }
      .progress-card__bar {
        height: 8px;
        background: var(--curtis-surface-2);
        border-radius: var(--curtis-radius-pill);
        overflow: hidden;
      }
      .progress-card__fill {
        height: 100%;
        background: linear-gradient(90deg, var(--green-500), var(--green-600));
        border-radius: var(--curtis-radius-pill);
        transition: width 300ms var(--curtis-ease-out);
      }
      .progress-card__meta {
        display: flex;
        justify-content: space-between;
        margin-top: var(--curtis-space-2);
        font-size: var(--curtis-text-xs);
        color: var(--curtis-text-subtle);
        font-variant-numeric: tabular-nums;
      }
      .progress-card__pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        border-radius: var(--curtis-radius-pill);
        background: color-mix(in srgb, var(--ion-color-primary) 12%, transparent);
        color: var(--ion-color-primary);
        font-weight: var(--curtis-weight-semibold);
      }
      .unknown {
        margin: 0 var(--curtis-space-4) var(--curtis-space-3);
        padding: var(--curtis-space-3) var(--curtis-space-4);
        background: color-mix(in srgb, var(--ion-color-warning) 14%, transparent);
        color: var(--amber-500);
        border: 1px solid color-mix(in srgb, var(--ion-color-warning) 30%, transparent);
        border-radius: var(--curtis-radius-md);
        font-size: var(--curtis-text-sm);
        display: flex;
        gap: var(--curtis-space-2);
        align-items: center;
      }
      .section-label {
        margin: var(--curtis-space-4) var(--curtis-space-5) var(--curtis-space-1);
        font-size: var(--curtis-text-xs);
        font-weight: var(--curtis-weight-bold);
        letter-spacing: var(--curtis-tracking-wider);
        text-transform: uppercase;
        color: var(--curtis-text-subtle);
      }
      .actions {
        padding: var(--curtis-space-4) var(--curtis-space-4)
                 calc(var(--curtis-space-8) + env(safe-area-inset-bottom, 0));
        display: flex;
        flex-direction: column;
        gap: var(--curtis-space-2);
      }
    `,
  ],
  template: `
    <curtis-header title="Route seals" backHref="/dashboard" />

    <ion-content [fullscreen]="true">
      <curtis-offline-banner />

      <div class="curtis-form-strip">
        <div class="curtis-form-strip__icon">
          <curtis-icon name="qr-code-outline" size="md" />
        </div>
        <div class="curtis-form-strip__text">
          <div class="curtis-form-strip__title">Scan route seals</div>
          <div class="curtis-form-strip__sub">Tick off each seal expected on this route, then submit.</div>
        </div>
      </div>

      @if (loading()) {
        <div class="curtis-empty">
          <div class="curtis-empty__well">
            <ion-spinner name="crescent" />
          </div>
          <div class="curtis-empty__title">Loading…</div>
          <div class="curtis-empty__body">Fetching expected seals for this route.</div>
        </div>
      } @else if (expected().length === 0) {
        <div class="curtis-empty">
          <div class="curtis-empty__well curtis-empty__well--success">
            <curtis-icon name="checkmark-done-circle-outline" size="xl" [strokeWidth]="1.5" />
          </div>
          <div class="curtis-empty__title">All clear</div>
          <div class="curtis-empty__body">No incoming seals are pending for this route.</div>
        </div>
      } @else {
        <div class="section-label">Scan progress</div>
        <div class="progress-card">
          <div class="progress-card__head">
            <span class="progress-card__label">Scanned</span>
            <span class="progress-card__counter">
              {{ scannedCount() }}<span class="total"> / {{ expected().length }}</span>
            </span>
          </div>
          <div class="progress-card__bar">
            <div class="progress-card__fill" [style.width.%]="progressPct()"></div>
          </div>
          <div class="progress-card__meta">
            <span class="progress-card__pill">
              <curtis-icon name="qr-code-outline" size="xs" />
              Route delivery
            </span>
            <span>{{ progressPct() }}%</span>
          </div>
        </div>

        @if (unknownScans().length > 0) {
          <div class="unknown">
            <curtis-icon name="alert-circle-outline" size="sm" />
            {{ unknownScans().length }} scan(s) didn't match the expected list — still recorded.
          </div>
        }

        <div class="section-label">Seals</div>
        <curtis-seal-list [seals]="display()" />

        <div class="actions">
          @if (!scanning()) {
            <curtis-scan-button label="Scan seals" (scan)="startScan()" />
          } @else {
            <ion-button color="medium" expand="block" (click)="stopScan()">
              <curtis-icon slot="start" name="close-outline" size="sm" />
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
              <curtis-icon slot="start" name="cloud-upload-outline" size="sm" />
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
