import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';

import { DeliveryStore } from '../../core/stores/delivery.store';
import { DeliveryService } from '../../core/services/delivery.service';
import { OfflineBannerComponent } from '../../shared/components/offline-banner/offline-banner.component';
import { CurtisIconComponent } from '../../shared/components/icon';
import { CurtisHeaderComponent } from '../../shared/components/header';

/**
 * Process — Phase 4, second step of the delivery chain.
 *
 * Records processing metadata (processingType, procType, seals, note) and
 * posts a PostStatusByUserId status beat via DeliveryService.postProcess.
 *
 * TODO(phase-0): the values for processingType and procType are not
 * documented. For now we expose free-text fields; once backend provides
 * the enum (if any) we'll switch to ion-select with known values.
 */
@Component({
  selector: 'curtis-process',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule, FormsModule, OfflineBannerComponent, CurtisIconComponent, CurtisHeaderComponent],
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
      .seal-summary {
        margin: 0 var(--curtis-space-4);
        padding: var(--curtis-space-3) var(--curtis-space-4);
        background: var(--curtis-surface-1);
        border: 1px solid var(--curtis-border);
        border-radius: var(--curtis-radius-md);
        box-shadow: var(--curtis-shadow-xs);
        display: flex;
        align-items: center;
        gap: var(--curtis-space-3);
      }
      .seal-summary__icon {
        width: 36px;
        height: 36px;
        border-radius: var(--curtis-radius-md);
        background: color-mix(in srgb, var(--ion-color-success) 14%, transparent);
        color: var(--green-600);
        display: grid;
        place-items: center;
        flex-shrink: 0;
      }
      .seal-summary__text { flex: 1; min-width: 0; }
      .seal-summary__title {
        font-size: var(--curtis-text-sm);
        font-weight: var(--curtis-weight-semibold);
        color: var(--curtis-text);
      }
      .seal-summary__ids {
        font-family: var(--curtis-font-mono);
        font-size: var(--curtis-text-xs);
        color: var(--curtis-text-muted);
        word-break: break-all;
        margin-top: 2px;
      }
      .seal-summary--empty .seal-summary__icon {
        background: color-mix(in srgb, var(--ion-color-warning) 14%, transparent);
        color: var(--amber-500);
      }
    `,
  ],
  template: `
    <curtis-header title="Process" backHref="/delivery-scan" />

    <ion-content [fullscreen]="true">
      <curtis-offline-banner />

      @if (!deliveryStore.isCheckedIn()) {
        <div class="warning">
          <curtis-icon name="warning-outline" size="sm" />
          Not checked in. Return and check in first.
        </div>
      } @else {
        <div class="curtis-form-strip">
          <div class="curtis-form-strip__icon">3</div>
          <div class="curtis-form-strip__text">
            <div class="curtis-form-strip__title">Record processing details</div>
            <div class="curtis-form-strip__sub">Confirm scan summary and processing type, then continue to signature.</div>
          </div>
        </div>

        <div class="section-label">Scanned seals</div>
        <div
          class="seal-summary"
          [class.seal-summary--empty]="deliveryStore.scannedSeals().length === 0"
        >
          <div class="seal-summary__icon">
            <curtis-icon
              [name]="deliveryStore.scannedSeals().length > 0 ? 'checkmark-circle-outline' : 'warning-outline'"
              size="sm"
            />
          </div>
          <div class="seal-summary__text">
            @if (deliveryStore.scannedSeals().length > 0) {
              <div class="seal-summary__title">
                {{ deliveryStore.scannedSeals().length }} seal(s) scanned
              </div>
              <div class="seal-summary__ids">{{ deliveryStore.scannedSeals().join(', ') }}</div>
            } @else {
              <div class="seal-summary__title">No seals scanned yet</div>
              <div class="seal-summary__ids">
                Return to the scan step to capture seals at this stop.
              </div>
            }
          </div>
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
    </ion-content>
  `,
})
export class ProcessPage {
  protected readonly deliveryStore = inject(DeliveryStore);
  private readonly deliverySvc = inject(DeliveryService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastController);

  protected readonly submitting = signal(false);
  protected processingType = '';
  protected procType = '';
  protected note = '';

  protected async submit(): Promise<void> {
    if (this.submitting()) return;
    this.submitting.set(true);
    try {
      // Seals come from DeliveryStore (set by /delivery-scan), not the
      // form. Serialised as comma-separated for the wire DTO (matches the
      // legacy backend's seals field convention).
      const sealsCsv = this.deliveryStore.scannedSeals().filter(Boolean).join(',');
      await this.deliverySvc.postProcess({
        processingType: this.processingType.trim() || undefined,
        procType: this.procType.trim() || undefined,
        seals: sealsCsv || undefined,
        note: this.note.trim() || undefined,
      });
      await this.router.navigateByUrl('/signature');
    } catch (err) {
      await this.showToast(this.describeError(err, 'Could not save process details.'), 'danger');
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
