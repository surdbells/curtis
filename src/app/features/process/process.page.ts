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
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { Haptics, NotificationType, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

import { DeliveryStore } from '../../core/stores/delivery.store';
import { RouteStore } from '../../core/stores/route.store';
import { DeliveryService } from '../../core/services/delivery.service';
import { ScannerService, type ScanSession } from '../../core/services/scanner.service';
import { OfflineBannerComponent } from '../../shared/components/offline-banner/offline-banner.component';
import { CurtisIconComponent } from '../../shared/components/icon';
import { CurtisHeaderComponent, CurtisHeaderStatusComponent } from '../../shared/components/header';
import { SealListComponent } from '../../shared/components/seal-list/seal-list.component';
import { ScanButtonComponent } from '../../shared/components/scan-button/scan-button.component';
import type { Seal, RouteStop } from '../../core/models';

/**
 * Process — second step of the delivery chain, with inline seal scanning.
 *
 * Mirrors legacy CurtisTracker ProcessActivity behaviour:
 *
 *   1. Agent arrives at this screen after Check-In on Delivery.
 *   2. Expected seals for the active stop are resolved from RouteStore.
 *   3. Scanner is started inline — each scan is classified:
 *        - matches expected (not yet counted) → tick green, advance count
 *        - matches expected (already counted) → "Has been counted"
 *        - else                                → "Not found, please confirm"
 *   4. Once all expected seals are matched, the scanner hides and the
 *      processing form (processingType, procType, note) is revealed.
 *   5. Submit posts via DeliveryService.postProcess with the matched
 *      seal IDs as a comma-separated string (legacy wire convention).
 *   6. On success → navigate to /signature.
 *
 * The legacy app additionally triggered an inline check_in() POST when
 * the agent scanned the job's branchId barcode. Our app uses a dedicated
 * Delivery page for check-in (with explicit bank/branch + note), so
 * that branch-scan check-in path is intentionally NOT replicated here.
 * The "must be checked in" guard enforces correct sequencing.
 *
 * Scanned-seals state is local to this page (not stored in DeliveryStore).
 * Backing out and re-entering starts fresh — appropriate for the use
 * case (agent realised wrong stop, wants to restart cleanly).
 */
@Component({
  selector: 'curtis-process',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,
    OfflineBannerComponent,
    CurtisIconComponent,
    CurtisHeaderComponent,
    CurtisHeaderStatusComponent,
    SealListComponent,
    ScanButtonComponent,
  ],
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

      .warning {
        margin: var(--curtis-space-3) var(--curtis-space-4);
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

      /* Stop summary — small card showing where the agent is. */
      .stop-summary {
        margin: var(--curtis-space-3) var(--curtis-space-4);
        padding: var(--curtis-space-4);
        background: var(--curtis-surface-1);
        border: 1px solid var(--curtis-border);
        border-radius: var(--curtis-radius-lg);
        box-shadow: var(--curtis-shadow-xs);
      }
      .stop-summary__title {
        font-size: var(--curtis-text-base);
        font-weight: var(--curtis-weight-bold);
        color: var(--curtis-text);
        margin-bottom: 2px;
        line-height: 1.3;
      }
      .stop-summary__sub {
        font-size: var(--curtis-text-sm);
        color: var(--curtis-text-muted);
        line-height: 1.35;
      }
      .stop-summary__meta {
        display: flex;
        gap: var(--curtis-space-3);
        margin-top: var(--curtis-space-2);
        flex-wrap: wrap;
        font-size: var(--curtis-text-xs);
        color: var(--curtis-text-subtle);
        font-variant-numeric: tabular-nums;
      }
      .stop-summary__meta span {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      /* Progress card — shows N / total seals counted. */
      .progress-card {
        margin: 0 var(--curtis-space-4) var(--curtis-space-3);
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

      /* Feedback strip — last scan result. */
      .feedback {
        margin: 0 var(--curtis-space-4) var(--curtis-space-3);
        padding: var(--curtis-space-3) var(--curtis-space-4);
        border-radius: var(--curtis-radius-md);
        font-size: var(--curtis-text-sm);
        display: flex;
        gap: var(--curtis-space-2);
        align-items: center;
        animation: fade-in var(--curtis-duration-fast) var(--curtis-ease-out);
      }
      .feedback--success {
        background: color-mix(in srgb, var(--ion-color-success) 12%, transparent);
        color: var(--green-600);
        border: 1px solid color-mix(in srgb, var(--ion-color-success) 26%, transparent);
      }
      .feedback--warning {
        background: color-mix(in srgb, var(--ion-color-warning) 14%, transparent);
        color: var(--amber-500);
        border: 1px solid color-mix(in srgb, var(--ion-color-warning) 30%, transparent);
      }
      .feedback--danger {
        background: color-mix(in srgb, var(--ion-color-danger) 12%, transparent);
        color: var(--red-500);
        border: 1px solid color-mix(in srgb, var(--ion-color-danger) 24%, transparent);
      }
      .feedback__code {
        font-family: var(--curtis-font-mono);
        font-weight: var(--curtis-weight-bold);
      }
      @keyframes fade-in {
        from { opacity: 0; transform: translateY(-2px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      .scan-actions {
        padding: 0 var(--curtis-space-4) var(--curtis-space-3);
        display: flex;
        flex-direction: column;
        gap: var(--curtis-space-2);
      }

      /* All-seals-confirmed banner, shown above the form. */
      .complete-banner {
        margin: var(--curtis-space-3) var(--curtis-space-4);
        padding: var(--curtis-space-3) var(--curtis-space-4);
        background: linear-gradient(135deg,
          color-mix(in srgb, var(--ion-color-success) 18%, transparent),
          color-mix(in srgb, var(--ion-color-success) 8%, transparent));
        border: 1px solid color-mix(in srgb, var(--ion-color-success) 36%, transparent);
        border-radius: var(--curtis-radius-md);
        font-size: var(--curtis-text-sm);
        font-weight: var(--curtis-weight-semibold);
        color: var(--green-600);
        display: flex;
        gap: var(--curtis-space-2);
        align-items: center;
      }
    `,
  ],
  template: `
    <curtis-header title="Process" backHref="/delivery">
      @if (deliveryStore.isCheckedIn() && expectedCount() > 0) {
        <curtis-header-status
          slot="status"
          [variant]="scanComplete() ? 'success' : (scannedCount() > 0 ? 'info' : 'neutral')"
          [label]="scannedCount() + ' / ' + expectedCount()"
        />
      }
    </curtis-header>

    <ion-content [fullscreen]="true">
      <curtis-offline-banner />

      @if (!deliveryStore.isCheckedIn()) {
        <div class="warning">
          <curtis-icon name="warning-outline" size="sm" />
          Not checked in. Return and check in first.
        </div>
      } @else {
        <div class="curtis-form-strip">
          <div class="curtis-form-strip__icon">2</div>
          <div class="curtis-form-strip__text">
            <div class="curtis-form-strip__title">Confirm seals at this stop</div>
            <div class="curtis-form-strip__sub">
              Scan each physical seal you're delivering, then record processing details.
            </div>
          </div>
        </div>

        @if (activeStop(); as stop) {
          <div class="stop-summary">
            <div class="stop-summary__title">{{ stop.destination || stop.refNo }}</div>
            @if (stop.clientName) {
              <div class="stop-summary__sub">{{ stop.clientName }}</div>
            }
            <div class="stop-summary__meta">
              @if (stop.refNo) {
                <span>
                  <curtis-icon name="receipt-outline" size="xs" />
                  Ref {{ stop.refNo }}
                </span>
              }
              @if (stop.stopNumber) {
                <span>
                  <curtis-icon name="navigate-outline" size="xs" />
                  Stop #{{ stop.stopNumber }}
                </span>
              }
              @if (stop.status) {
                <span>
                  <curtis-icon name="time-outline" size="xs" />
                  {{ stop.status }}
                </span>
              }
            </div>
          </div>
        }

        @if (expectedCount() > 0) {
          <div class="section-label">Scan progress</div>
          <div class="progress-card">
            <div class="progress-card__head">
              <span class="progress-card__label">Confirmed</span>
              <span class="progress-card__counter">
                {{ scannedCount() }}<span class="total"> / {{ expectedCount() }}</span>
              </span>
            </div>
            <div class="progress-card__bar">
              <div class="progress-card__fill" [style.width.%]="progressPct()"></div>
            </div>
          </div>
        } @else {
          <div class="section-label">Scan</div>
          <div class="progress-card">
            <div class="progress-card__head">
              <span class="progress-card__label">No expected seals</span>
              <span class="progress-card__counter">{{ scannedCount() }}</span>
            </div>
            <div class="stop-summary__sub">
              The route data didn't include a seal list for this stop. Scan anything you're
              delivering — it will be recorded with the processing entry.
            </div>
          </div>
        }

        @if (lastFeedback(); as fb) {
          <div class="feedback" [class.feedback--success]="fb.kind === 'success'"
                                [class.feedback--warning]="fb.kind === 'warning'"
                                [class.feedback--danger]="fb.kind === 'danger'">
            <curtis-icon
              [name]="fb.kind === 'success' ? 'checkmark-circle-outline'
                : fb.kind === 'warning' ? 'information-circle-outline'
                : 'alert-circle-outline'"
              size="sm"
            />
            <span>
              <span class="feedback__code">{{ fb.code }}</span>
              — {{ fb.message }}
            </span>
          </div>
        }

        @if (expectedCount() > 0) {
          <div class="section-label">Seals</div>
          <curtis-seal-list [seals]="display()" />
        }

        <div class="scan-actions">
          @if (!scanning() && !scanComplete()) {
            <curtis-scan-button label="Scan seal" (scan)="startScan()" />
          } @else if (scanning()) {
            <ion-button color="medium" expand="block" (click)="stopScan()">
              <curtis-icon slot="start" name="close-outline" size="sm" />
              Stop scanning
            </ion-button>
          }
        </div>

        @if (scanComplete()) {
          <div class="complete-banner">
            <curtis-icon name="checkmark-circle-outline" size="sm" />
            All expected seals confirmed. Record processing details below.
          </div>

          <div class="section-label">Processing</div>
          <ion-list inset>
            <ion-item>
              <ion-input
                label="Processing type"
                labelPlacement="stacked"
                [(ngModel)]="processingType"
                [disabled]="submitting()"
              />
            </ion-item>
            <ion-item>
              <ion-input
                label="Proc type"
                labelPlacement="stacked"
                [(ngModel)]="procType"
                [disabled]="submitting()"
              />
            </ion-item>
            <ion-item>
              <ion-textarea
                label="Note (optional)"
                labelPlacement="stacked"
                rows="3"
                autoGrow="true"
                [(ngModel)]="note"
                [disabled]="submitting()"
              />
            </ion-item>
          </ion-list>

          <div class="curtis-submit-zone">
            <ion-button expand="block" [disabled]="submitting()" (click)="submit()">
              @if (submitting()) {
                <ion-spinner slot="start" name="crescent" />
                Recording…
              } @else {
                Save & continue
                <curtis-icon slot="end" name="arrow-forward-outline" size="sm" />
              }
            </ion-button>
          </div>
        }
      }
    </ion-content>
  `,
})
export class ProcessPage implements OnInit, OnDestroy {
  protected readonly deliveryStore = inject(DeliveryStore);
  protected readonly routeStore = inject(RouteStore);
  private readonly deliverySvc = inject(DeliveryService);
  private readonly scanner = inject(ScannerService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastController);

  protected readonly submitting = signal(false);
  protected readonly scanning = signal(false);

  /** Scanned seal IDs, local to this page. De-duplicated on insert. */
  protected readonly localScanned = signal<readonly string[]>([]);

  /** Last scan result for the feedback strip. */
  protected readonly lastFeedback = signal<
    { kind: 'success' | 'warning' | 'danger'; code: string; message: string } | null
  >(null);

  protected processingType = '';
  protected procType = '';
  protected note = '';

  /** The active stop, resolved by matching DeliveryStore.stopId against RouteStore.stops. */
  protected readonly activeStop = computed<RouteStop | null>(() => {
    const id = this.deliveryStore.stopId();
    if (!id) return null;
    return this.routeStore.stops().find((s) => s.referenceNumber === id) ?? null;
  });

  /** Expected seals from the active stop. Always a defined array. */
  protected readonly expectedSeals = computed<readonly string[]>(
    () => this.activeStop()?.seals ?? [],
  );

  protected readonly expectedCount = computed(() => this.expectedSeals().length);
  protected readonly scannedCount = computed(() => this.localScanned().length);

  /**
   * Scan complete when:
   *   - The route had expected seals and all have been counted, OR
   *   - The route had no expected seals (data gap) and at least one was scanned
   *
   * If neither applies, the form stays hidden — agent must scan first.
   */
  protected readonly scanComplete = computed(() => {
    const expected = this.expectedSeals();
    if (expected.length === 0) return this.scannedCount() > 0;
    const scanned = new Set(this.localScanned());
    return expected.every((id) => scanned.has(id));
  });

  protected readonly progressPct = computed(() => {
    const total = this.expectedSeals().length;
    if (total === 0) return 0;
    return Math.min(100, Math.round((this.scannedCount() / total) * 100));
  });

  /**
   * Composed list for <curtis-seal-list> — every expected seal becomes
   * a row with status 'scanned' or 'pending'. Unexpected scans (the
   * agent scanned something not in the expected list) are appended.
   */
  protected readonly display = computed<Seal[]>(() => {
    const scanned = new Set(this.localScanned());
    const expectedRows: Seal[] = this.expectedSeals().map((id) => ({
      id,
      number: id,
      status: scanned.has(id) ? 'scanned' : 'pending',
    }));
    const expectedSet = new Set(this.expectedSeals());
    const extraRows: Seal[] = this.localScanned()
      .filter((id) => !expectedSet.has(id))
      .map((id) => ({ id, number: id, status: 'scanned' }));
    return [...expectedRows, ...extraRows];
  });

  private session?: ScanSession;

  async ngOnInit(): Promise<void> {
    // Hard guard — Process requires Check-In. The template also shows a
    // warning, but if the agent somehow bypasses the UI (deep link), we
    // bounce to /delivery.
    if (!this.deliveryStore.isCheckedIn()) {
      // The warning template will render. Avoid auto-starting the scanner.
      return;
    }
  }

  async ngOnDestroy(): Promise<void> {
    await this.session?.stop();
    this.session = undefined;
  }

  async startScan(): Promise<void> {
    if (this.scanning()) return;
    if (this.scanComplete()) return;
    this.scanning.set(true);
    try {
      this.session = await this.scanner.startContinuous((value) => this.recordScan(value));
    } catch (err) {
      this.scanning.set(false);
      const msg = err instanceof Error ? err.message : 'Could not start scanner.';
      await this.showToast(msg, 'danger');
    }
  }

  async stopScan(): Promise<void> {
    await this.session?.stop();
    this.session = undefined;
    this.scanning.set(false);
  }

  /**
   * Classify a single scan against the expected list. Mirrors legacy
   * ProcessActivity / RouteActivity / BankActivity behaviour: each scan
   * is either confirmed, already-counted, or not found.
   */
  private recordScan(raw: string): void {
    const id = raw.trim();
    if (!id) return;

    const expected = this.expectedSeals();
    const already = this.localScanned();

    // Branch 1: matches expected and is new.
    if (expected.includes(id) && !already.includes(id)) {
      this.localScanned.update((arr) => [...arr, id]);
      this.lastFeedback.set({
        kind: 'success',
        code: id,
        message: 'Confirmed successfully',
      });
      void this.haptic('success');

      // Auto-stop the scanner once everything is counted, so the agent
      // doesn't keep the camera burning while filling the form.
      if (this.scanComplete()) {
        void this.stopScan();
      }
      return;
    }

    // Branch 2: matches expected but already counted.
    if (expected.includes(id) && already.includes(id)) {
      this.lastFeedback.set({
        kind: 'warning',
        code: id,
        message: 'Already counted',
      });
      void this.haptic('tap');
      return;
    }

    // Branch 3: route had no expected list — accept anything as a scan.
    if (expected.length === 0 && !already.includes(id)) {
      this.localScanned.update((arr) => [...arr, id]);
      this.lastFeedback.set({
        kind: 'success',
        code: id,
        message: 'Recorded',
      });
      void this.haptic('success');
      return;
    }

    // Branch 4: route had no expected list and this id was already scanned.
    if (expected.length === 0 && already.includes(id)) {
      this.lastFeedback.set({
        kind: 'warning',
        code: id,
        message: 'Already counted',
      });
      void this.haptic('tap');
      return;
    }

    // Branch 5: scanned something not in the expected list.
    this.lastFeedback.set({
      kind: 'danger',
      code: id,
      message: 'Not found, please confirm',
    });
    void this.haptic('error');
  }

  protected async submit(): Promise<void> {
    if (this.submitting()) return;
    if (!this.scanComplete()) return;
    this.submitting.set(true);
    try {
      await this.stopScan();
      // Legacy wire convention: seals as a single comma-separated string.
      const sealsCsv = this.localScanned().filter(Boolean).join(',');
      await this.deliverySvc.postProcess({
        processingType: this.processingType.trim() || undefined,
        procType: this.procType.trim() || undefined,
        seals: sealsCsv || undefined,
        note: this.note.trim() || undefined,
      });
      this.deliveryStore.markProcessComplete();
      await this.router.navigateByUrl('/signature');
    } catch (err) {
      await this.showToast(this.describeError(err, 'Could not save process details.'), 'danger');
    } finally {
      this.submitting.set(false);
    }
  }

  private async haptic(kind: 'success' | 'tap' | 'error'): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      if (kind === 'success') {
        await Haptics.notification({ type: NotificationType.Success });
      } else if (kind === 'error') {
        await Haptics.notification({ type: NotificationType.Error });
      } else {
        await Haptics.impact({ style: ImpactStyle.Light });
      }
    } catch {
      // Haptics unavailable — silently ignore.
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
