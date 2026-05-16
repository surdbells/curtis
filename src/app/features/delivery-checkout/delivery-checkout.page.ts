import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';

import { DeliveryStore } from '../../core/stores/delivery.store';
import { DeliveryService } from '../../core/services/delivery.service';
import { OfflineBannerComponent } from '../../shared/components/offline-banner/offline-banner.component';
import { CurtisIconComponent } from '../../shared/components/icon';

/**
 * Check-Out — Phase 4, final step of the delivery chain.
 *
 * Displays a summary of the delivery (bank, branch, check-in time,
 * signature captured) and lets the agent add a closing note before
 * POSTing /check_out.
 *
 * Check-Out button is disabled unless DeliveryStore reports
 * canCheckOut() = isCheckedIn && hasSignature.
 *
 * On success: DeliveryService.checkOut clears the DeliveryStore and we
 * navigate back to /daily so the agent moves to the next stop.
 */
@Component({
  selector: 'curtis-delivery-checkout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule, FormsModule, OfflineBannerComponent, CurtisIconComponent],
  styles: [
    `
      :host { display: block; }
      ion-content { --background: var(--curtis-bg); }
      .summary {
        margin: var(--curtis-space-3) var(--curtis-space-4);
        background: var(--curtis-surface-1);
        border: 1px solid var(--curtis-border);
        border-radius: var(--curtis-radius-lg);
        box-shadow: var(--curtis-shadow-xs);
        overflow: hidden;
      }
      .summary__row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--curtis-space-3) var(--curtis-space-4);
        border-bottom: 1px solid var(--curtis-border);
      }
      .summary__row:last-child { border-bottom: none; }
      .summary__label {
        font-size: var(--curtis-text-sm);
        color: var(--curtis-text-muted);
        font-weight: var(--curtis-weight-medium);
      }
      .summary__value {
        font-weight: var(--curtis-weight-semibold);
        font-size: var(--curtis-text-sm);
        color: var(--curtis-text);
        font-variant-numeric: tabular-nums;
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
      ion-list { background: transparent; margin: 0 var(--curtis-space-3); }
      ion-list[inset] ion-item {
        --background: var(--curtis-surface-1);
        --border-color: var(--curtis-border);
      }
      .section-label {
        margin: var(--curtis-space-4) var(--curtis-space-5) var(--curtis-space-1);
        font-size: var(--curtis-text-xs);
        font-weight: var(--curtis-weight-bold);
        letter-spacing: var(--curtis-tracking-wider);
        text-transform: uppercase;
        color: var(--curtis-text-subtle);
      }
    `,
  ],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/signature"></ion-back-button>
        </ion-buttons>
        <ion-title>Check out</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <curtis-offline-banner />

      @if (!deliveryStore.canCheckOut()) {
        <div class="warning">
          <curtis-icon name="warning-outline" size="sm" />
          @if (!deliveryStore.isCheckedIn()) {
            Not checked in. Complete check-in first.
          } @else if (!deliveryStore.hasSignature()) {
            Signature required before check-out.
          } @else {
            Cannot check out yet.
          }
        </div>
      } @else {
        <div class="curtis-form-strip">
          <div class="curtis-form-strip__icon">4</div>
          <div class="curtis-form-strip__text">
            <div class="curtis-form-strip__title">Confirm and check out</div>
            <div class="curtis-form-strip__sub">Review the delivery summary, then complete the stop.</div>
          </div>
        </div>

        <div class="section-label">Summary</div>
        <div class="summary">
          <div class="summary__row">
            <span class="summary__label">Bank</span>
            <span class="summary__value">{{ deliveryStore.bankId() || '—' }}</span>
          </div>
          <div class="summary__row">
            <span class="summary__label">Branch</span>
            <span class="summary__value">{{ deliveryStore.branchId() || '—' }}</span>
          </div>
          @if (deliveryStore.state()) {
            <div class="summary__row">
              <span class="summary__label">State</span>
              <span class="summary__value">{{ deliveryStore.state() }}</span>
            </div>
          }
          <div class="summary__row">
            <span class="summary__label">Checked in</span>
            <span class="summary__value">{{ (deliveryStore.checkInAt() | date: 'short') || '—' }}</span>
          </div>
          <div class="summary__row">
            <span class="summary__label">Process</span>
            <span class="summary__value">
              {{ deliveryStore.processComplete() ? 'Complete' : 'Skipped' }}
            </span>
          </div>
          <div class="summary__row">
            <span class="summary__label">Signature</span>
            <span class="summary__value">
              {{ deliveryStore.hasSignature() ? 'Captured' : 'Missing' }}
            </span>
          </div>
        </div>

        <div class="section-label">Closing note</div>
        <ion-list inset>
          <ion-item>
            <ion-textarea
              label="Closing note (optional)"
              labelPlacement="stacked"
              rows="2"
              autoGrow="true"
              [(ngModel)]="note"
              [disabled]="submitting()"
            />
          </ion-item>
        </ion-list>

        <div class="curtis-submit-zone">
          <ion-button
            expand="block"
            color="primary"
            [disabled]="submitting()"
            (click)="submit()"
          >
            @if (submitting()) {
              <ion-spinner slot="start" name="crescent" />
              Checking out…
            } @else {
              <curtis-icon slot="start" name="checkmark-circle-outline" size="sm" />
              Confirm check-out
            }
          </ion-button>
        </div>
      }
    </ion-content>
  `,
})
export class DeliveryCheckoutPage {
  protected readonly deliveryStore = inject(DeliveryStore);
  private readonly deliverySvc = inject(DeliveryService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastController);

  protected readonly submitting = signal(false);
  protected note = '';

  protected async submit(): Promise<void> {
    if (this.submitting() || !this.deliveryStore.canCheckOut()) return;
    this.submitting.set(true);
    try {
      await this.deliverySvc.checkOut({
        note: this.note.trim() || undefined,
      });
      await this.showToast('Delivery complete.', 'success');
      await this.router.navigateByUrl('/daily', { replaceUrl: true });
    } catch (err) {
      await this.showToast(this.describeError(err, 'Check-out failed.'), 'danger');
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
