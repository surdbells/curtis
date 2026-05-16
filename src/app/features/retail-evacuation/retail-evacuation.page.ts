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
  imports: [CommonModule, IonicModule, FormsModule, OfflineBannerComponent],
  styles: [
    `
      .preview {
        margin: 1rem; border-radius: 12px; overflow: hidden;
        background: var(--ion-color-light);
        display: flex; align-items: center; justify-content: center;
        min-height: 200px;
      }
      .preview img { width: 100%; display: block; }
      .preview .placeholder {
        color: var(--ion-color-medium); padding: 2rem; text-align: center;
      }
      .actions { padding: 1rem; display: grid; gap: 0.5rem; }
    `,
  ],
  template: `
    <ion-header translucent>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/dashboard" />
        </ion-buttons>
        <ion-title>Retail evacuation</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <curtis-offline-banner />

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

      <div class="preview">
        @if (imageBase64()) {
          <img [src]="'data:image/jpeg;base64,' + imageBase64()" alt="Receipt preview" />
        } @else {
          <div class="placeholder">
            <ion-icon name="camera-outline" style="font-size: 3rem;" />
            <p>No receipt captured yet</p>
          </div>
        }
      </div>

      <div class="actions">
        <ion-button expand="block" fill="outline" (click)="capture()" [disabled]="submitting()">
          <ion-icon slot="start" name="camera-outline" />
          {{ imageBase64() ? 'Retake' : 'Capture' }} receipt
        </ion-button>
        <ion-button expand="block" [disabled]="!canSubmit() || submitting()" (click)="submit()">
          @if (submitting()) {
            <ion-spinner slot="start" name="crescent" />
            Submitting…
          } @else {
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
