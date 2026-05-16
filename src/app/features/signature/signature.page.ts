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
      :host { display: block; }
      ion-content { --background: var(--curtis-bg); }
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
      .pad-wrap {
        padding: var(--curtis-space-3) var(--curtis-space-4);
      }
    `,
  ],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/process"></ion-back-button>
        </ion-buttons>
        <ion-title>Signature</ion-title>
      </ion-toolbar>
    </ion-header>

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
            <div class="curtis-form-strip__title">Capture teller signature</div>
            <div class="curtis-form-strip__sub">Ask the receiving teller to sign below to complete the delivery.</div>
          </div>
        </div>

        <div class="pad-wrap">
          <curtis-signature-pad
            #pad
            (end)="onStroke($event)"
          />
        </div>

        <div class="curtis-submit-zone">
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
              <curtis-icon slot="end" name="arrow-forward-outline" size="sm" />
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
