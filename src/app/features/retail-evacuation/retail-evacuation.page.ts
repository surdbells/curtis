import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';

import { RetailerService } from '../../core/services/retailer.service';
import { CameraService } from '../../core/services/camera.service';
import { EvacuationService } from '../../core/services/evacuation.service';
import { ConnectivityService } from '../../core/services/connectivity.service';
import { OfflineBannerComponent } from '../../shared/components/offline-banner/offline-banner.component';
import { CurtisIconComponent } from '../../shared/components/icon';
import { CurtisHeaderComponent } from '../../shared/components/header';
import type { Retailer, RetailerBranch } from '../../core/models';

/**
 * Retail evacuation — Phase 5.
 *
 * Field-ops flow:
 *   1. Pick a retailer (cached + XML fallback).
 *   2. Pick a retailer branch (cascaded from retailer id, sourced from
 *      bundled rtbranch.xml).
 *   3. Enter reference number (optional).
 *   4. Capture receipt photo via @capacitor/camera.
 *   5. Submit -> POST /PostEvacuationReceipt with base64 image.
 */
@Component({
  selector: 'curtis-retail-evacuation',
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

      .preview {
        margin: 0 var(--curtis-space-4);
        border-radius: var(--curtis-radius-lg);
        background: var(--curtis-surface-1);
        border: 1px solid var(--curtis-border);
        overflow: hidden;
        min-height: 220px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: var(--curtis-shadow-xs);
      }
      .preview img {
        width: 100%;
        display: block;
        object-fit: cover;
      }
      .placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--curtis-space-2);
        padding: var(--curtis-space-6);
        text-align: center;
      }
      .placeholder__well {
        width: 64px;
        height: 64px;
        border-radius: var(--curtis-radius-xl);
        background: var(--curtis-surface-2);
        color: var(--curtis-text-muted);
        display: grid;
        place-items: center;
      }
      .placeholder__text {
        font-size: var(--curtis-text-sm);
        color: var(--curtis-text-muted);
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
    <curtis-header title="Retail evacuation" backHref="/dashboard" />

    <ion-content [fullscreen]="true">
      <curtis-offline-banner />

      <div class="curtis-form-strip">
        <div class="curtis-form-strip__icon curtis-form-strip__icon--tertiary">
          <curtis-icon name="receipt-outline" size="md" />
        </div>
        <div class="curtis-form-strip__text">
          <div class="curtis-form-strip__title">Retail evacuation</div>
          <div class="curtis-form-strip__sub">Capture retailer info and the receipt photo, then submit.</div>
        </div>
      </div>

      <div class="section-label">Retailer</div>
      <ion-list inset>
        <ion-item>
          <ion-select
            label="Retailer"
            labelPlacement="stacked"
            interface="action-sheet"
            [(ngModel)]="retailerId"
            (ionChange)="onRetailerChange()"
            [disabled]="submitting()"
          >
            @for (r of retailers(); track r.id) {
              <ion-select-option [value]="r.id">{{ r.name }}</ion-select-option>
            }
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-select
            label="Retailer branch"
            labelPlacement="stacked"
            interface="action-sheet"
            [(ngModel)]="retailerBranchId"
            [disabled]="!retailerId || branches().length === 0 || submitting()"
          >
            @for (br of branches(); track br.id) {
              <ion-select-option [value]="br.id">{{ br.name }}</ion-select-option>
            }
          </ion-select>
        </ion-item>
      </ion-list>

      <div class="section-label">Details</div>
      <ion-list inset>
        <ion-item>
          <ion-input
            label="Reference number"
            labelPlacement="stacked"
            [(ngModel)]="refNumber"
            [disabled]="submitting()"
          />
        </ion-item>
        <ion-item>
          <ion-textarea
            label="Note (optional)"
            labelPlacement="stacked"
            rows="2"
            autoGrow="true"
            [(ngModel)]="note"
            [disabled]="submitting()"
          />
        </ion-item>
      </ion-list>

      <div class="section-label">Receipt photo</div>
      <div class="preview">
        @if (imageBase64()) {
          <img [src]="'data:image/jpeg;base64,' + imageBase64()" alt="Receipt preview" />
        } @else {
          <div class="placeholder">
            <div class="placeholder__well">
              <curtis-icon name="camera-outline" size="lg" [strokeWidth]="1.5" />
            </div>
            <div class="placeholder__text">No receipt captured yet</div>
          </div>
        }
      </div>

      <div class="actions">
        <ion-button expand="block" fill="outline" (click)="capture()" [disabled]="submitting()">
          <curtis-icon slot="start" name="camera-outline" size="sm" />
          {{ imageBase64() ? 'Retake' : 'Capture' }} receipt
        </ion-button>
        <ion-button expand="block" [disabled]="!canSubmit() || submitting()" (click)="submit()">
          @if (submitting()) {
            <ion-spinner slot="start" name="crescent" />
            Submitting…
          } @else {
            <curtis-icon slot="start" name="cloud-upload-outline" size="sm" />
            Submit receipt
          }
        </ion-button>
      </div>
    </ion-content>
  `,
})
export class RetailEvacuationPage implements OnInit {
  private readonly retailerSvc = inject(RetailerService);
  private readonly camera = inject(CameraService);
  private readonly evac = inject(EvacuationService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly toast = inject(ToastController);
  private readonly router = inject(Router);

  protected readonly retailers = signal<Retailer[]>([]);
  protected readonly branches = signal<RetailerBranch[]>([]);
  protected readonly imageBase64 = signal<string | null>(null);
  protected readonly submitting = signal(false);

  protected retailerId: string | null = null;
  protected retailerBranchId: string | null = null;
  protected refNumber = '';
  protected note = '';

  protected readonly canSubmit = computed(
    () => !!this.retailerId && !!this.retailerBranchId && !!this.imageBase64(),
  );

  async ngOnInit(): Promise<void> {
    this.retailers.set(await this.retailerSvc.getRetailers());
  }

  async onRetailerChange(): Promise<void> {
    this.retailerBranchId = null;
    if (!this.retailerId) {
      this.branches.set([]);
      return;
    }
    this.branches.set(await this.retailerSvc.getBranchesForRetailer(this.retailerId));
  }

  async capture(): Promise<void> {
    try {
      const b64 = await this.camera.capture({ quality: 70 });
      this.imageBase64.set(b64);
    } catch (err) {
      // User cancelled or permission denied — silent unless explicit error.
      const msg = (err as { message?: string } | undefined)?.message;
      if (msg && !msg.toLowerCase().includes('cancel')) {
        await this.showToast(msg, 'danger');
      }
    }
  }

  async submit(): Promise<void> {
    if (!this.canSubmit() || this.submitting()) return;
    if (!this.connectivity.online()) {
      await this.showToast('Offline — will sync when connection returns.', 'warning');
    }
    this.submitting.set(true);
    try {
      await this.evac.postRetail({
        retailerId: this.retailerId!,
        retailerBranchId: this.retailerBranchId!,
        imageBase64: this.imageBase64()!,
        refNumber: this.refNumber.trim() || undefined,
        note: this.note.trim() || undefined,
      });
      await this.showToast('Retail receipt submitted.', 'success');
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
