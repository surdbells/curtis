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
    `,
  ],
  template: `
    <curtis-header title="Process" backHref="/delivery" />

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
            <div class="curtis-form-strip__title">Record processing details</div>
            <div class="curtis-form-strip__sub">Capture seals and process type, then continue to signature.</div>
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
