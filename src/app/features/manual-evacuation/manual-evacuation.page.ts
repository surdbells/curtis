import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';

import { BankService } from '../../core/services/bank.service';
import { ScannerService } from '../../core/services/scanner.service';
import { EvacuationService } from '../../core/services/evacuation.service';
import { ConnectivityService } from '../../core/services/connectivity.service';
import { OfflineBannerComponent } from '../../shared/components/offline-banner/offline-banner.component';
import { CurtisIconComponent } from '../../shared/components/icon';
import type { ScanSession } from '../../core/services/scanner.service';
import type { Bank, Branch } from '../../core/models';

/**
 * Manual evacuation — Phase 5.
 *
 * Agent-initiated evacuation when the standard route flow doesn't apply.
 *
 * Fields per legacy ManualActivity.java: bankid, branchid (origination),
 * destinationbranchid, processingtype, seals (comma-separated), note.
 *
 * Bank picker is offline-first (BankService cache + XML fallback). Once a
 * bank is picked, the branches dropdown is loaded from the XML manifest
 * (no per-bank API endpoint exists).
 *
 * Seals are scanned continuously via ScannerService and accumulate as an
 * array of strings — comma-joined on submit by EvacuationService.
 */
@Component({
  selector: 'curtis-manual-evacuation',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule, FormsModule, OfflineBannerComponent, CurtisIconComponent],
  styles: [
    `
      .scanned-row {
        display: flex; align-items: center; justify-content: space-between;
        gap: 0.5rem; padding: 0.5rem 1rem;
        border-bottom: 1px solid var(--ion-color-light-shade);
      }
      .scanned-row code { font-size: 0.8rem; color: var(--ion-color-medium); }
      .actions { padding: 1rem; display: grid; gap: 0.5rem; }
      .seals-empty {
        text-align: center; padding: 1rem; color: var(--ion-color-medium); font-size: 0.85rem;
      }
    `,
  ],
  template: `
    <ion-header translucent>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/dashboard" />
        </ion-buttons>
        <ion-title>Manual evacuation</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <curtis-offline-banner />

      <ion-list inset>
        <ion-item>
          <ion-select
            label="Origin bank"
            labelPlacement="stacked"
            interface="action-sheet"
            [(ngModel)]="originBankId"
            (ionChange)="onOriginBankChange()"
            [disabled]="submitting()"
          >
            @for (b of banks(); track b.id) {
              <ion-select-option [value]="b.id">{{ b.name }}</ion-select-option>
            }
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-select
            label="Origin branch"
            labelPlacement="stacked"
            interface="action-sheet"
            [(ngModel)]="originBranchId"
            [disabled]="!originBankId || originBranches().length === 0 || submitting()"
          >
            @for (br of originBranches(); track br.id) {
              <ion-select-option [value]="br.id">{{ br.name }}</ion-select-option>
            }
          </ion-select>
        </ion-item>

        <ion-item>
          <ion-select
            label="Destination bank"
            labelPlacement="stacked"
            interface="action-sheet"
            [(ngModel)]="destBankId"
            (ionChange)="onDestBankChange()"
            [disabled]="submitting()"
          >
            @for (b of banks(); track b.id) {
              <ion-select-option [value]="b.id">{{ b.name }}</ion-select-option>
            }
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-select
            label="Destination branch"
            labelPlacement="stacked"
            interface="action-sheet"
            [(ngModel)]="destBranchId"
            [disabled]="!destBankId || destBranches().length === 0 || submitting()"
          >
            @for (br of destBranches(); track br.id) {
              <ion-select-option [value]="br.id">{{ br.name }}</ion-select-option>
            }
          </ion-select>
        </ion-item>

        <ion-item>
          <ion-input
            label="Processing type"
            labelPlacement="stacked"
            [(ngModel)]="processingType"
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

      <ion-list-header>
        <ion-label>
          Seals
          @if (sealIds().length > 0) {
            <ion-chip color="success">{{ sealIds().length }}</ion-chip>
          }
        </ion-label>
      </ion-list-header>

      @if (sealIds().length === 0) {
        <div class="seals-empty">No seals scanned yet. Tap "Scan seals" to begin.</div>
      } @else {
        @for (id of sealIds(); track id) {
          <div class="scanned-row">
            <code>{{ id }}</code>
            <ion-button fill="clear" size="small" color="medium" (click)="removeSeal(id)">
              <curtis-icon slot="icon-only" name="close-circle-outline" />
            </ion-button>
          </div>
        }
      }

      <div class="actions">
        @if (!scanning()) {
          <ion-button expand="block" fill="outline" (click)="startScan()" [disabled]="submitting()">
            <curtis-icon slot="start" name="qr-code-outline" />
            Scan seals
          </ion-button>
        } @else {
          <ion-button expand="block" color="medium" (click)="stopScan()">
            <curtis-icon slot="start" name="close-outline" />
            Stop scanning
          </ion-button>
        }
        <ion-button
          expand="block"
          [disabled]="!canSubmit() || submitting()"
          (click)="submit()"
        >
          @if (submitting()) {
            <ion-spinner slot="start" name="crescent" />
            Submitting…
          } @else {
            Submit manual evacuation
          }
        </ion-button>
      </div>
    </ion-content>
  `,
})
export class ManualEvacuationPage implements OnInit, OnDestroy {
  private readonly bankSvc = inject(BankService);
  private readonly scanner = inject(ScannerService);
  private readonly evac = inject(EvacuationService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly toast = inject(ToastController);
  private readonly router = inject(Router);

  protected readonly banks = signal<Bank[]>([]);
  protected readonly originBranches = signal<Branch[]>([]);
  protected readonly destBranches = signal<Branch[]>([]);
  protected readonly sealIds = signal<string[]>([]);
  protected readonly scanning = signal(false);
  protected readonly submitting = signal(false);

  protected originBankId: string | null = null;
  protected originBranchId: string | null = null;
  protected destBankId: string | null = null;
  protected destBranchId: string | null = null;
  protected processingType = '';
  protected note = '';

  private session?: ScanSession;

  protected readonly canSubmit = computed(
    () => !!this.originBankId && !!this.originBranchId && this.sealIds().length > 0,
  );

  async ngOnInit(): Promise<void> {
    const list = await this.bankSvc.getBanksWithCache();
    this.banks.set(list);
  }

  async ngOnDestroy(): Promise<void> {
    await this.session?.stop();
    this.session = undefined;
  }

  async onOriginBankChange(): Promise<void> {
    this.originBranchId = null;
    if (!this.originBankId) {
      this.originBranches.set([]);
      return;
    }
    this.originBranches.set(await this.bankSvc.getBranchesForBank(this.originBankId));
  }

  async onDestBankChange(): Promise<void> {
    this.destBranchId = null;
    if (!this.destBankId) {
      this.destBranches.set([]);
      return;
    }
    this.destBranches.set(await this.bankSvc.getBranchesForBank(this.destBankId));
  }

  async startScan(): Promise<void> {
    if (this.scanning()) return;
    this.scanning.set(true);
    try {
      this.session = await this.scanner.startContinuous((value) => {
        const v = value.trim();
        if (!v) return;
        this.sealIds.update((arr) => (arr.includes(v) ? arr : [...arr, v]));
      });
    } catch (err) {
      this.scanning.set(false);
      await this.showToast(this.describeError(err, 'Could not start scanner.'), 'danger');
    }
  }

  async stopScan(): Promise<void> {
    await this.session?.stop();
    this.session = undefined;
    this.scanning.set(false);
  }

  removeSeal(id: string): void {
    this.sealIds.update((arr) => arr.filter((s) => s !== id));
  }

  async submit(): Promise<void> {
    if (!this.canSubmit() || this.submitting()) return;
    if (!this.connectivity.online()) {
      await this.showToast('Offline — will sync when connection returns.', 'warning');
    }
    await this.stopScan();
    this.submitting.set(true);
    try {
      await this.evac.postManual({
        bankId: this.originBankId!,
        branchId: this.originBranchId!,
        destinationBranchId: this.destBranchId ?? undefined,
        processingType: this.processingType.trim() || undefined,
        sealIds: this.sealIds(),
        note: this.note.trim() || undefined,
      });
      await this.showToast('Manual evacuation submitted.', 'success');
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
