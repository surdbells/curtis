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
      .summary {
        padding: 0.75rem 1rem 0;
        display: grid;
        gap: 0.5rem;
      }
      .summary .row {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.6rem 0.9rem;
        background: var(--ion-color-light);
        border-radius: 10px;
      }
      .summary .label {
        color: var(--ion-color-medium);
        font-size: 0.8rem;
      }
      .summary .value {
        font-weight: 600;
      }
      .warning {
        margin: 0.75rem 1rem;
        padding: 0.9rem 1rem;
        border-radius: 10px;
        background: var(--ion-color-warning);
        color: var(--ion-color-warning-contrast);
        font-size: 0.85rem;
      }
    `,
  ],
  template: `
    <ion-header translucent>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/signature" />
        </ion-buttons>
        <ion-title>Check out</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <curtis-offline-banner />

      @if (!deliveryStore.canCheckOut()) {
        <div class="warning">
          <curtis-icon name="warning-outline" />
          @if (!deliveryStore.isCheckedIn()) {
            Not checked in. Complete check-in first.
          } @else if (!deliveryStore.hasSignature()) {
            Signature required before check-out.
          } @else {
            Cannot check out yet.
          }
        </div>
      } @else {
        <div class="summary">
          <div class="row">
            <span class="label">Bank</span>
            <span class="value">{{ deliveryStore.bankId() || '—' }}</span>
          </div>
          <div class="row">
            <span class="label">Branch</span>
            <span class="value">{{ deliveryStore.branchId() || '—' }}</span>
          </div>
          @if (deliveryStore.state()) {
            <div class="row">
              <span class="label">State</span>
              <span class="value">{{ deliveryStore.state() }}</span>
            </div>
          }
          <div class="row">
            <span class="label">Checked in</span>
            <span class="value">{{ (deliveryStore.checkInAt() | date: 'short') || '—' }}</span>
          </div>
          <div class="row">
            <span class="label">Process</span>
            <span class="value">
              {{ deliveryStore.processComplete() ? 'Complete' : 'Skipped' }}
            </span>
          </div>
          <div class="row">
            <span class="label">Signature</span>
            <span class="value">
              {{ deliveryStore.hasSignature() ? 'Captured' : 'Missing' }}
            </span>
          </div>
        </div>

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

        <div class="ion-padding">
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
