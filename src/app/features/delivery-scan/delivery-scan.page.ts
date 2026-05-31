import {
  Component,
  ChangeDetectionStrategy,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { Haptics, NotificationType, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

import { DeliveryStore } from '../../core/stores/delivery.store';
import { ScannerService, type ScanSession } from '../../core/services/scanner.service';
import { OfflineBannerComponent } from '../../shared/components/offline-banner/offline-banner.component';
import { CurtisIconComponent } from '../../shared/components/icon';
import { CurtisHeaderComponent, CurtisHeaderStatusComponent } from '../../shared/components/header';
import { ScanButtonComponent } from '../../shared/components/scan-button/scan-button.component';
import { SealListComponent } from '../../shared/components/seal-list/seal-list.component';
import type { Seal } from '../../core/models';

/**
 * Delivery-Scan — per-stop seal scanning at destination arrival.
 *
 * Slots into the delivery flow between Check-In and Process:
 *
 *   Daily → Delivery (check-in) → [Delivery-Scan] → Process → Signature → Check-Out
 *
 * Data sources:
 *   - Expected seals come from RouteStop.seals (already in DeliveryStore
 *     after Daily.selectStop seeds it via beginDelivery).
 *   - Scanned seals are captured here via ScannerService.startContinuous
 *     and matched against expected.
 *
 * On submit:
 *   - Calls DeliveryStore.setScannedSeals() with the final list (any IDs
 *     the agent confirmed, including unexpected scans the agent kept).
 *   - Routes to /process for the next step.
 *
 * Gating:
 *   - If the agent lands here without being checked in, redirect to /delivery
 *     with an explanatory toast.
 *
 * The submit button is enabled once at least one seal has been scanned,
 * but a warning chip surfaces if any expected seals remain missing — so
 * the agent can consciously proceed with an incomplete scan if needed.
 */
@Component({
  selector: 'curtis-delivery-scan',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonicModule,
    OfflineBannerComponent,
    CurtisIconComponent,
    CurtisHeaderComponent,
    CurtisHeaderStatusComponent,
    ScanButtonComponent,
    SealListComponent,
  ],
  styles: [
    `
      :host { display: block; }
      ion-content { --background: var(--curtis-bg); }

      .section-label {
        margin: var(--curtis-space-4) var(--curtis-space-5) var(--curtis-space-1);
        font-size: var(--curtis-text-xs);
        font-weight: var(--curtis-weight-bold);
        letter-spacing: var(--curtis-tracking-wider);
        text-transform: uppercase;
        color: var(--curtis-text-subtle);
        display: flex;
        align-items: center;
        gap: var(--curtis-space-2);
      }

      /* Progress card — same idiom as the previous bank/route scan pages. */
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

      /* Anomaly blocks */
      .unexpected, .missing {
        margin: 0 var(--curtis-space-4) var(--curtis-space-3);
        padding: var(--curtis-space-3) var(--curtis-space-4);
        border-radius: var(--curtis-radius-md);
        font-size: var(--curtis-text-sm);
        display: flex;
        gap: var(--curtis-space-2);
        align-items: flex-start;
      }
      .unexpected {
        background: color-mix(in srgb, var(--ion-color-warning) 14%, transparent);
        color: var(--amber-500);
        border: 1px solid color-mix(in srgb, var(--ion-color-warning) 30%, transparent);
      }
      .missing {
        background: color-mix(in srgb, var(--ion-color-danger) 12%, transparent);
        color: var(--red-500);
        border: 1px solid color-mix(in srgb, var(--ion-color-danger) 24%, transparent);
      }
      .unexpected__body, .missing__body {
        flex: 1;
      }
      .unexpected__title, .missing__title {
        font-weight: var(--curtis-weight-bold);
        margin-bottom: 2px;
      }
      .unexpected__ids, .missing__ids {
        font-family: var(--curtis-font-mono);
        font-size: var(--curtis-text-xs);
        opacity: 0.85;
        word-break: break-all;
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
    <curtis-header title="Scan seals" backHref="/delivery">
      <curtis-header-status
        slot="status"
        [variant]="scanComplete() ? 'success' : (scannedCount() > 0 ? 'info' : 'neutral')"
        [label]="
          expectedCount() === 0
            ? (scannedCount() + ' scanned')
            : (scannedCount() + ' / ' + expectedCount())
        "
      />
    </curtis-header>

    <ion-content [fullscreen]="true">
      <curtis-offline-banner />

      <div class="curtis-form-strip">
        <div class="curtis-form-strip__icon">
          <curtis-icon name="barcode-outline" size="md" />
        </div>
        <div class="curtis-form-strip__text">
          <div class="curtis-form-strip__title">Confirm seals at this stop</div>
          <div class="curtis-form-strip__sub">
            Scan each physical seal you're delivering. Mismatches are flagged.
          </div>
        </div>
      </div>

      @if (expectedCount() === 0) {
        <div class="curtis-empty">
          <div class="curtis-empty__well">
            <curtis-icon name="information-circle-outline" size="xl" [strokeWidth]="1.5" />
          </div>
          <div class="curtis-empty__title">No expected seals listed</div>
          <div class="curtis-empty__body">
            The route data didn't include a seal list for this stop. You can still scan whatever you're delivering — anything you scan will be recorded.
          </div>
        </div>
      } @else {
        <div class="section-label">Scan progress</div>
        <div class="progress-card">
          <div class="progress-card__head">
            <span class="progress-card__label">Scanned</span>
            <span class="progress-card__counter">
              {{ scannedCount() }}<span class="total"> / {{ expectedCount() }}</span>
            </span>
          </div>
          <div class="progress-card__bar">
            <div class="progress-card__fill" [style.width.%]="progressPct()"></div>
          </div>
          <div class="progress-card__meta">
            <span class="progress-card__pill">
              <curtis-icon name="qr-code-outline" size="xs" />
              At destination
            </span>
            <span>{{ progressPct() }}%</span>
          </div>
        </div>
      }

      @if (unexpectedScans().length > 0) {
        <div class="unexpected">
          <curtis-icon name="alert-circle-outline" size="sm" />
          <div class="unexpected__body">
            <div class="unexpected__title">
              {{ unexpectedScans().length }} unexpected scan(s)
            </div>
            <div class="unexpected__ids">{{ unexpectedScans().join(', ') }}</div>
          </div>
        </div>
      }

      @if (missingScans().length > 0 && scannedCount() > 0) {
        <div class="missing">
          <curtis-icon name="warning-outline" size="sm" />
          <div class="missing__body">
            <div class="missing__title">
              {{ missingScans().length }} expected seal(s) not yet scanned
            </div>
            <div class="missing__ids">{{ missingScans().join(', ') }}</div>
          </div>
        </div>
      }

      <div class="section-label">Seals</div>
      <curtis-seal-list [seals]="display()" />

      <div class="actions">
        @if (!scanning()) {
          <curtis-scan-button label="Scan seal" (scan)="startScan()" />
        } @else {
          <ion-button color="medium" expand="block" (click)="stopScan()">
            <curtis-icon slot="start" name="close-outline" size="sm" />
            Stop scanning
          </ion-button>
        }
        <ion-button
          expand="block"
          [disabled]="submitting() || scannedCount() === 0"
          (click)="confirm()"
        >
          @if (submitting()) {
            <ion-spinner slot="start" name="crescent" />
            Saving…
          } @else {
            <curtis-icon slot="start" name="checkmark-circle-outline" size="sm" />
            Confirm & continue
            <curtis-icon slot="end" name="arrow-forward-outline" size="sm" />
          }
        </ion-button>
      </div>
    </ion-content>
  `,
})
export class DeliveryScanPage implements OnInit, OnDestroy {
  private readonly delivery = inject(DeliveryStore);
  private readonly scanner = inject(ScannerService);
  private readonly toast = inject(ToastController);
  private readonly router = inject(Router);

  protected readonly scanning = signal(false);
  protected readonly submitting = signal(false);

  /** Local scanned-IDs accumulator. De-duped on insert. */
  protected readonly localScanned = signal<readonly string[]>([]);

  protected readonly expectedCount = computed(() => this.delivery.expectedSeals().length);
  protected readonly scannedCount = computed(() => this.localScanned().length);
  protected readonly scanComplete = computed(() => {
    const expected = this.delivery.expectedSeals();
    if (expected.length === 0) return this.scannedCount() > 0;
    const scanned = new Set(this.localScanned());
    return expected.every((id) => scanned.has(id));
  });

  protected readonly unexpectedScans = computed(() => {
    const expected = new Set(this.delivery.expectedSeals());
    return this.localScanned().filter((id) => !expected.has(id));
  });

  protected readonly missingScans = computed(() => {
    const scanned = new Set(this.localScanned());
    return this.delivery.expectedSeals().filter((id) => !scanned.has(id));
  });

  protected readonly progressPct = computed(() => {
    const total = this.delivery.expectedSeals().length;
    if (total === 0) return 0;
    return Math.min(100, Math.round((this.scannedCount() / total) * 100));
  });

  /**
   * Composes the list that's shown via curtis-seal-list. Each expected
   * seal becomes a Seal with status='scanned' or 'pending', plus
   * unexpected scans appended at the bottom with status='scanned'.
   */
  protected readonly display = computed<Seal[]>(() => {
    const scanned = new Set(this.localScanned());
    const expectedRows: Seal[] = this.delivery.expectedSeals().map((id) => ({
      id,
      number: id,
      status: scanned.has(id) ? 'scanned' : 'pending',
    }));
    const expectedSet = new Set(this.delivery.expectedSeals());
    const extraRows: Seal[] = this.localScanned()
      .filter((id) => !expectedSet.has(id))
      .map((id) => ({ id, number: id, status: 'scanned' }));
    return [...expectedRows, ...extraRows];
  });

  private session?: ScanSession;

  async ngOnInit(): Promise<void> {
    // Guard: must be checked in before scanning.
    if (!this.delivery.isCheckedIn()) {
      const t = await this.toast.create({
        message: 'Check in at the stop before scanning seals.',
        duration: 2500,
        position: 'top',
        color: 'warning',
        buttons: [{ icon: 'close', role: 'cancel' }],
      });
      await t.present();
      void this.router.navigateByUrl('/delivery', { replaceUrl: true });
      return;
    }

    // Hydrate from any previously-scanned seals (in case the agent
    // backed out and returned).
    const prior = this.delivery.scannedSeals();
    if (prior.length > 0) this.localScanned.set(prior);
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
      const msg = err instanceof Error ? err.message : 'Could not start scanner.';
      const t = await this.toast.create({
        message: msg,
        duration: 3000,
        position: 'top',
        color: 'danger',
        buttons: [{ icon: 'close', role: 'cancel' }],
      });
      await t.present();
    }
  }

  async stopScan(): Promise<void> {
    await this.session?.stop();
    this.session = undefined;
    this.scanning.set(false);
  }

  private recordScan(raw: string): void {
    const id = raw.trim();
    if (!id) return;
    this.localScanned.update((arr) => (arr.includes(id) ? arr : [...arr, id]));
  }

  async confirm(): Promise<void> {
    if (this.submitting()) return;
    this.submitting.set(true);
    try {
      await this.stopScan();
      await this.haptic('success');
      this.delivery.setScannedSeals(this.localScanned());
      await this.router.navigateByUrl('/process');
    } finally {
      this.submitting.set(false);
    }
  }

  private async haptic(kind: 'success' | 'tap'): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      if (kind === 'success') {
        await Haptics.notification({ type: NotificationType.Success });
      } else {
        await Haptics.impact({ style: ImpactStyle.Light });
      }
    } catch {
      // ignore
    }
  }
}
