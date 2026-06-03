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
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';

import { SealService } from '../../core/services/seal.service';
import { ScannerService } from '../../core/services/scanner.service';
import { BankService } from '../../core/services/bank.service';
import { ConnectivityService } from '../../core/services/connectivity.service';
import { OfflineBannerComponent } from '../../shared/components/offline-banner/offline-banner.component';
import { CurtisIconComponent } from '../../shared/components/icon';
import { CurtisHeaderComponent } from '../../shared/components/header';
import { SealListComponent } from '../../shared/components/seal-list/seal-list.component';
import { ScanButtonComponent } from '../../shared/components/scan-button/scan-button.component';
import type { ScanSession } from '../../core/services/scanner.service';
import type { Bank, Seal } from '../../core/models';

/**
 * Bank seals scan — Phase 5.
 *
 * Workflow:
 *   1. Agent picks a bank from the bank selector.
 *   2. GET /GetIncomingSealsByBank for that bank + current user.
 *   3. Continuous scanning + real-time tick-off (same as route-scan).
 *   4. Submit POSTs comma-separated seal IDs to /PostIncomingSealsByBank.
 */
@Component({
  selector: 'curtis-bank-scan',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,
    OfflineBannerComponent,
    SealListComponent,
    ScanButtonComponent, CurtisIconComponent, CurtisHeaderComponent],
  styles: [
    `
      :host { display: block; }
      ion-content { --background: var(--curtis-bg); }
      ion-list { background: transparent; margin: 0 var(--curtis-space-3); }
      ion-list[inset] ion-item {
        --background: var(--curtis-surface-1);
        --border-color: var(--curtis-border);
        --min-height: 56px;
      }
      .section-label {
        margin: var(--curtis-space-4) var(--curtis-space-5) var(--curtis-space-1);
        font-size: var(--curtis-text-xs);
        font-weight: var(--curtis-weight-bold);
        letter-spacing: var(--curtis-tracking-wider);
        text-transform: uppercase;
        color: var(--curtis-text-subtle);
      }

      /* Progress card — replaces the old summary + progress bar pair */
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

      /* Warning block for unknown scans */
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
    <curtis-header title="Bank seals" backHref="/dashboard" />

    <ion-content [fullscreen]="true">
      <curtis-offline-banner />

      <div class="curtis-form-strip">
        <div class="curtis-form-strip__icon">
          <curtis-icon name="barcode-outline" size="md" />
        </div>
        <div class="curtis-form-strip__text">
          <div class="curtis-form-strip__title">Scan incoming bank seals</div>
          <div class="curtis-form-strip__sub">Pick a bank, scan each seal, then submit.</div>
        </div>
      </div>

      <div class="section-label">Bank</div>
      <ion-list inset>
        <ion-item>
          <ion-select
            label="Bank"
            labelPlacement="stacked"
            interface="action-sheet"
            [(ngModel)]="selectedBankId"
            (ionChange)="onBankChange()"
            [disabled]="loadingBanks() || scanning() || submitting()"
          >
            @for (b of banks(); track b.id) {
              <ion-select-option [value]="b.id">{{ b.name }}</ion-select-option>
            }
          </ion-select>
        </ion-item>
      </ion-list>

      @if (!selectedBankId) {
        <div class="curtis-empty">
          <div class="curtis-empty__well">
            <curtis-icon name="business-outline" size="xl" [strokeWidth]="1.5" />
          </div>
          <div class="curtis-empty__title">Choose a bank</div>
          <div class="curtis-empty__body">
            Select a bank from the dropdown above to load its incoming seals.
          </div>
        </div>
      } @else if (loadingSeals()) {
        <div class="curtis-empty">
          <div class="curtis-empty__well">
            <ion-spinner name="crescent" />
          </div>
          <div class="curtis-empty__title">Loading…</div>
          <div class="curtis-empty__body">Fetching the expected seals for this bank.</div>
        </div>
      } @else if (expected().length === 0) {
        <div class="curtis-empty">
          <div class="curtis-empty__well curtis-empty__well--success">
            <curtis-icon name="checkmark-done-circle-outline" size="xl" [strokeWidth]="1.5" />
          </div>
          <div class="curtis-empty__title">All clear</div>
          <div class="curtis-empty__body">No incoming seals are pending for this bank.</div>
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
              <curtis-icon name="business-outline" size="xs" />
              Bank delivery
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
export class BankScanPage implements OnInit, OnDestroy {
  private readonly seals = inject(SealService);
  private readonly scanner = inject(ScannerService);
  private readonly bankSvc = inject(BankService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly toast = inject(ToastController);
  private readonly router = inject(Router);

  protected readonly banks = signal<Bank[]>([]);
  protected readonly expected = signal<Seal[]>([]);
  protected readonly scannedIds = signal<Set<string>>(new Set<string>());
  protected readonly unknownScans = signal<string[]>([]);
  protected readonly loadingBanks = signal(false);
  protected readonly loadingSeals = signal(false);
  protected readonly scanning = signal(false);
  protected readonly submitting = signal(false);
  protected selectedBankId: string | null = null;

  private session?: ScanSession;

  protected readonly scannedCount = computed(() => this.scannedIds().size);
  protected readonly progressPct = computed(() => {
    const total = this.expected().length;
    if (total === 0) return 0;
    return Math.min(100, (this.scannedIds().size / total) * 100);
  });
  protected readonly display = computed<Seal[]>(() => {
    const scanned = this.scannedIds();
    return this.expected().map((s) => ({
      ...s,
      status: scanned.has(String(s.id)) ? 'scanned' : (s.status ?? 'pending'),
    }));
  });

  async ngOnInit(): Promise<void> {
    this.loadingBanks.set(true);
    try {
      const list = await this.bankSvc.getBanksWithCache();
      this.banks.set(list);
    } finally {
      this.loadingBanks.set(false);
    }
  }

  async ngOnDestroy(): Promise<void> {
    await this.session?.stop();
    this.session = undefined;
  }

  async onBankChange(): Promise<void> {
    if (!this.selectedBankId) return;
    this.scannedIds.set(new Set<string>());
    this.unknownScans.set([]);
    this.loadingSeals.set(true);
    try {
      const list = await firstValueFrom(this.seals.getIncomingByBank(this.selectedBankId)).catch(() => []);
      this.expected.set(list ?? []);
    } finally {
      this.loadingSeals.set(false);
    }
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

  private recordScan(raw: string): void {
    const match = this.expected().find(
      (s) => String(s.id) === raw.trim() || String(s.number) === raw.trim(),
    );
    if (match) {
      this.scannedIds.update((s) => new Set(s).add(String(match.id)));
    } else {
      this.unknownScans.update((u) => (u.includes(raw) ? u : [...u, raw]));
    }
  }

  async submit(): Promise<void> {
    if (!this.selectedBankId || this.submitting() || this.scannedCount() === 0) return;
    if (!this.connectivity.online()) {
      await this.showToast('Offline — submission will sync when connection returns.', 'warning');
    }
    await this.stopScan();
    this.submitting.set(true);
    try {
      const ids = Array.from(this.scannedIds()).concat(this.unknownScans());
      await this.seals.postIncomingByBank(this.selectedBankId, { sealIds: ids });
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
