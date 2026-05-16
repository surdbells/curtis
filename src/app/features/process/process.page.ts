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
  imports: [CommonModule, IonicModule, FormsModule, OfflineBannerComponent, CurtisIconComponent],
  styles: [
    `
      .note {
        padding: 0 1rem;
        color: var(--ion-color-medium);
        font-size: 0.85rem;
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
          <ion-back-button defaultHref="/delivery" />
        </ion-buttons>
        <ion-title>Process</ion-title>
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
          Record the processing details for this delivery, then continue to
          capture the teller signature.
        </p>

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
            <ion-input
              label="Seals"
              labelPlacement="stacked"
              placeholder="Comma-separated seal references"
              [(ngModel)]="seals"
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

        <div class="ion-padding">
          <ion-button expand="block" [disabled]="submitting()" (click)="submit()">
            @if (submitting()) {
              <ion-spinner slot="start" name="crescent" />
              Recording…
            } @else {
              Save & continue
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
  protected seals = '';
  protected note = '';

  protected async submit(): Promise<void> {
    if (this.submitting()) return;
    this.submitting.set(true);
    try {
      await this.deliverySvc.postProcess({
        processingType: this.processingType.trim() || undefined,
        procType: this.procType.trim() || undefined,
        seals: this.seals.trim() || undefined,
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
