import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';

import { DeliveryStore } from '../../core/stores/delivery.store';
import { BankService } from '../../core/services/bank.service';
import { DeliveryService } from '../../core/services/delivery.service';
import { ConnectivityService } from '../../core/services/connectivity.service';
import { OfflineBannerComponent } from '../../shared/components/offline-banner/offline-banner.component';
import { NIGERIAN_STATES } from '../../core/models/nigerian-states';
import type { Bank, Branch } from '../../core/models';

/**
 * Delivery info — Phase 4, first step of the delivery chain.
 *
 * Captures bank + branch selection and performs check-in.
 *
 *   Daily stop tapped -> DeliveryStore.beginDelivery() populates bankId /
 *   branchId if the stop had them. We hydrate the form from the store;
 *   the agent can override the selection manually.
 *
 * Cascade:
 *   State (static list) -> Branches (GET /GetBranchesByState/{state})
 *   Bank  (static list from GET /GetBanks) — used only for display/audit;
 *   the agent picks a branch which already knows its bank.
 *
 * On Check-In:
 *   - DeliveryService.checkIn posts /Check_In + status beat
 *   - DeliveryStore.markCheckedIn() flips canProceedToProcess
 *   - Navigate to /process
 */
@Component({
  selector: 'curtis-delivery',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule, FormsModule, OfflineBannerComponent],
  styles: [
    `
      .section-note {
        color: var(--ion-color-medium);
        font-size: 0.8rem;
        padding: 0 1rem 0.5rem;
      }
    `,
  ],
  template: `
    <ion-header translucent>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/daily" />
        </ion-buttons>
        <ion-title>Delivery</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <curtis-offline-banner />

      <p class="section-note">
        Select the bank and branch for this delivery, then check in.
      </p>

      <ion-list inset>
        <ion-item>
          <ion-select
            label="Bank"
            labelPlacement="stacked"
            interface="action-sheet"
            [(ngModel)]="selectedBankId"
            [disabled]="loadingBanks() || submitting()"
          >
            @for (b of banks(); track b.id) {
              <ion-select-option [value]="b.id">{{ b.name || b.id }}</ion-select-option>
            }
          </ion-select>
        </ion-item>

        <ion-item>
          <ion-select
            label="State"
            labelPlacement="stacked"
            interface="action-sheet"
            [(ngModel)]="selectedState"
            (ionChange)="onStateChange()"
            [disabled]="submitting()"
          >
            @for (s of states; track s) {
              <ion-select-option [value]="s">{{ s }}</ion-select-option>
            }
          </ion-select>
        </ion-item>

        <ion-item>
          <ion-select
            label="Branch"
            labelPlacement="stacked"
            interface="action-sheet"
            [(ngModel)]="selectedBranchId"
            [disabled]="!selectedState || loadingBranches() || submitting()"
          >
            @if (loadingBranches()) {
              <ion-select-option disabled>Loading branches…</ion-select-option>
            } @else if (branches().length === 0 && selectedState) {
              <ion-select-option disabled>No branches for this state</ion-select-option>
            } @else {
              @for (br of branches(); track br.id) {
                <ion-select-option [value]="br.id">
                  {{ br.name || br.address || br.id }}
                </ion-select-option>
              }
            }
          </ion-select>
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

      <div class="ion-padding">
        <ion-button
          expand="block"
          [disabled]="!canCheckIn() || submitting()"
          (click)="checkIn()"
        >
          @if (submitting()) {
            <ion-spinner slot="start" name="crescent" />
            Checking in…
          } @else {
            Check in
          }
        </ion-button>
      </div>
    </ion-content>
  `,
})
export class DeliveryPage implements OnInit {
  private readonly deliveryStore = inject(DeliveryStore);
  private readonly deliverySvc = inject(DeliveryService);
  private readonly banksSvc = inject(BankService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly toast = inject(ToastController);
  private readonly router = inject(Router);

  protected readonly states = NIGERIAN_STATES;
  protected readonly banks = signal<Bank[]>([]);
  protected readonly branches = signal<Branch[]>([]);
  protected readonly loadingBanks = signal(false);
  protected readonly loadingBranches = signal(false);
  protected readonly submitting = signal(false);

  protected selectedBankId: string | null = null;
  protected selectedState: string | null = null;
  protected selectedBranchId: string | null = null;
  protected note = '';

  async ngOnInit(): Promise<void> {
    // Pre-fill from DeliveryStore (populated when the agent tapped a stop).
    this.selectedBankId = this.deliveryStore.bankId();
    this.selectedBranchId = this.deliveryStore.branchId();
    this.selectedState = this.deliveryStore.state();

    await this.loadBanks();
    if (this.selectedState) {
      await this.loadBranches(this.selectedState);
    }
  }

  protected canCheckIn(): boolean {
    return !!this.selectedBankId && !!this.selectedBranchId;
  }

  protected async onStateChange(): Promise<void> {
    this.selectedBranchId = null;
    if (this.selectedState) {
      await this.loadBranches(this.selectedState);
    } else {
      this.branches.set([]);
    }
  }

  private async loadBanks(): Promise<void> {
    this.loadingBanks.set(true);
    try {
      const banks = await this.banksSvc.getBanksWithCache();
      this.banks.set(banks);
    } finally {
      this.loadingBanks.set(false);
    }
  }

  private async loadBranches(state: string): Promise<void> {
    this.loadingBranches.set(true);
    try {
      const list = await this.banksSvc.getBranchesByStateWithCache(state);
      this.branches.set(list);
    } finally {
      this.loadingBranches.set(false);
    }
  }

  protected async checkIn(): Promise<void> {
    if (!this.canCheckIn() || this.submitting()) return;

    const bankId = String(this.selectedBankId);
    const branchId = String(this.selectedBranchId);

    this.deliveryStore.setBankBranch({
      bankId,
      branchId,
      state: this.selectedState,
    });

    this.submitting.set(true);
    try {
      await this.deliverySvc.checkIn({
        bankId,
        branchId,
        note: this.note.trim() || undefined,
      });
      await this.router.navigateByUrl('/process');
    } catch (err) {
      await this.showToast(this.describeError(err, 'Check-in failed.'), 'danger');
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
