import {
  Component,
  ChangeDetectionStrategy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';

import { DeliveryStore } from '../../core/stores/delivery.store';
import { DeliveryService } from '../../core/services/delivery.service';
import { OfflineBannerComponent } from '../../shared/components/offline-banner/offline-banner.component';
import { CurtisIconComponent } from '../../shared/components/icon';
import { SignaturePadComponent } from '../../shared/components/signature-pad/signature-pad.component';

/**
 * Signature — Phase 4, third step of the delivery chain.
 *
 * Renders the shared SignaturePadComponent full-width. Save button is
 * disabled until the pad has a stroke; Save posts the signature and
 * navigates to the checkout confirmation.
 */
@Component({
  selector: 'curtis-signature',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule, OfflineBannerComponent, SignaturePadComponent, CurtisIconComponent],
  styles: [
    `
      .note {
        padding: 0 1rem;
        color: var(--ion-color-medium);
        font-size: 0.85rem;
      }
      .pad-wrap {
        padding: 1rem;
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
          <ion-back-button defaultHref="/process" />
        </ion-buttons>
        <ion-title>Signature</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <curtis-offline-banner />

      @if (!deliveryStore.isCheckedIn()) {
        <div class="warning">
          <curtis-icon name="warning-outline" /> Not checked in. Return and check in first.
        </div>
      } @else {
        <p class="note">
          Ask the receiving teller to sign below. A signature is required
          to complete this delivery.
        </p>

        <div class="pad-wrap">
          <curtis-signature-pad
            #pad
            (end)="onStroke($event)"
          />
        </div>

        <div class="ion-padding">
          <ion-button
            expand="block"
            [disabled]="!hasStroke() || submitting()"
            (click)="submit()"
          >
            @if (submitting()) {
              <ion-spinner slot="start" name="crescent" />
              Saving signature…
            } @else {
              Save signature & continue
            }
          </ion-button>
        </div>
      }
    </ion-content>
  `,
})
export class SignaturePage {
  @ViewChild('pad') pad?: SignaturePadComponent;

  protected readonly deliveryStore = inject(DeliveryStore);
  private readonly deliverySvc = inject(DeliveryService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastController);

  protected readonly hasStroke = signal(false);
  protected readonly submitting = signal(false);
  private latestDataUrl: string | null = null;

  protected onStroke(dataUrl: string): void {
    this.latestDataUrl = dataUrl;
    this.hasStroke.set(!!dataUrl);
  }

  protected async submit(): Promise<void> {
    if (this.submitting()) return;
    const dataUrl = this.latestDataUrl ?? this.pad?.toDataUrl();
    if (!dataUrl) {
      await this.showToast('Please capture a signature before saving.', 'warning');
      return;
    }

    this.submitting.set(true);
    try {
      await this.deliverySvc.postSignature(dataUrl);
      await this.router.navigateByUrl('/delivery-checkout');
    } catch (err) {
      await this.showToast(this.describeError(err, 'Could not save signature.'), 'danger');
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
