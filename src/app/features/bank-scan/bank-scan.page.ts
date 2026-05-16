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
import { firstValueFrom } from 'rxjs';

import { SealService } from '../../core/services/seal.service';
import { ScannerService } from '../../core/services/scanner.service';
import { BankService } from '../../core/services/bank.service';
import { ConnectivityService } from '../../core/services/connectivity.service';
import { OfflineBannerComponent } from '../../shared/components/offline-banner/offline-banner.component';
import { CurtisIconComponent } from '../../shared/components/icon';
import { SealListComponent } from '../../shared/components/seal-list/seal-list.component';
import { ScanButtonComponent } from '../../shared/components/scan-button/scan-button.component';
import type { ScanSession } from '../../core/services/scanner.service';
import type { Bank, Seal } from '../../core/models';

/**
 * Bank seals scan — Phase 5.
 *
 * Workflow:
 *   1. Agent picks a bank from the bank selector.
 *   2. GET /GetIncomingSealsByBank for that bank + current user.
 *   3. Continuous scanning + real-time tick-off (same as route-scan).
 *   4. Submit POSTs comma-separated seal IDs to /PostIncomingSealsByBank.
 */
@Component({
  selector: 'curtis-bank-scan',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,
    OfflineBannerComponent,
    SealListComponent,
    ScanButtonComponent, CurtisIconComponent],
  styles: [
    `
      .summary {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem 1rem;
        background: var(--ion-color-light);
      }
      .summary strong { font-size: 1.1rem; }
      .progress { height: 6px; background: var(--ion-color-light); }
      .progress-bar { height: 100%; background: var(--ion-color-success); transition: width 200ms ease-out; }
      .unknown {
        margin: 0.75rem 1rem; padding: 0.5rem 0.75rem;
        background: var(--ion-color-warning);
        color: var(--ion-color-warning-contrast);
        border-radius: 8px; font-size: 0.8rem;
      }
      .actions { padding: 1rem; display: grid; gap: 0.5rem; }
      .empty { text-align: center; padding: 2.5rem 1rem; color: var(--ion-color-medium); }
    `,
  ],
  template: `
    <ion-header translucent>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/dashboard" />
        </ion-buttons>
        <ion-title>Bank seals</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <curtis-offline-banner />

      <ion-list inset>
        <ion-item>
          <ion-select
            label="Bank"
            labelPlacement="stacked"
            interface="action-sheet"
            [(ngModel)]="selectedBankId"
            (ionChange)="onBankChange()"
            [disabled]="loadingBanks() || scanning() || submitting()"
          >
            @for (b of banks(); track b.id) {
              <ion-select-option [value]="b.id">{{ b.name }}</ion-select-option>
            }
          </ion-select>
        </ion-item>
      </ion-list>

      @if (!selectedBankId) {
        <div class="empty">
          <curtis-icon name="business-outline" style="font-size: 3rem;" />
          <p>Select a bank to load its incoming seals.</p>
        </div>
      } @else if (loadingSeals()) {
        <div class="empty">
          <ion-spinner name="crescent" />
          <p>Loading expected seals…</p>
        </div>
      } @else if (expected().length === 0) {
        <div class="empty">
          <curtis-icon name="checkmark-done-circle-outline" style="font-size: 3rem;" />
          <p>No incoming seals for this bank.</p>
        </div>
      } @else {
        <div class="summary">
          <div>
            <strong>{{ scannedCount() }}</strong> / {{ expected().length }} scanned
          </div>
          <ion-chip color="primary">
            <curtis-icon name="business-outline" />
            <ion-label>Bank</ion-label>
          </ion-chip>
        </div>
        <div class="progress">
          <div class="progress-bar" [style.width.%]="progressPct()"></div>
        </div>

        @if (unknownScans().length > 0) {
          <div class="unknown">
            <curtis-icon name="alert-circle-outline" />
            {{ unknownScans().length }} scan(s) didn't match the expected list — still recorded.
          </div>
        }

        <curtis-seal-list [seals]="display()" />

        <div class="actions">
          @if (!scanning()) {
            <curtis-scan-button label="Scan seals" (scan)="startScan()" />
          } @else {
            <ion-button color="medium" expand="block" (click)="stopScan()">
              <curtis-icon slot="start" name="close-outline" />
              Stop scanning
            </ion-button>
          }
          <ion-button
            color="tertiary"
            expand="block"
            [disabled]="submitting() || scannedCount() === 0"
            (click)="submit()"
          >
            @if (submitting()) {
              <ion-spinner slot="start" name="crescent" />
              Submitting…
            } @else {
              Submit {{ scannedCount() }} seal(s)
            }
          </ion-button>
        </div>
      }
    </ion-content>
  `,
})
export class BankScanPage implements OnInit, OnDestroy {
  private readonly seals = inject(SealService);
  private readonly scanner = inject(ScannerService);
  private readonly bankSvc = inject(BankService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly toast = inject(ToastController);
  private readonly router = inject(Router);

  protected readonly banks = signal<Bank[]>([]);
  protected readonly expected = signal<Seal[]>([]);
  protected readonly scannedIds = signal<Set<string>>(new Set<string>());
  protected readonly unknownScans = signal<string[]>([]);
  protected readonly loadingBanks = signal(false);
  protected readonly loadingSeals = signal(false);
  protected readonly scanning = signal(false);
  protected readonly submitting = signal(false);
  protected selectedBankId: string | null = null;

  private session?: ScanSession;

  protected readonly scannedCount = computed(() => this.scannedIds().size);
  protected readonly progressPct = computed(() => {
    const total = this.expected().length;
    if (total === 0) return 0;
    return Math.min(100, (this.scannedIds().size / total) * 100);
  });
  protected readonly display = computed<Seal[]>(() => {
    const scanned = this.scannedIds();
    return this.expected().map((s) => ({
      ...s,
      status: scanned.has(String(s.id)) ? 'scanned' : (s.status ?? 'pending'),
    }));
  });

  async ngOnInit(): Promise<void> {
    this.loadingBanks.set(true);
    try {
      const list = await this.bankSvc.getBanksWithCache();
      this.banks.set(list);
    } finally {
      this.loadingBanks.set(false);
    }
  }

  async ngOnDestroy(): Promise<void> {
    await this.session?.stop();
    this.session = undefined;
  }

  async onBankChange(): Promise<void> {
    if (!this.selectedBankId) return;
    this.scannedIds.set(new Set<string>());
    this.unknownScans.set([]);
    this.loadingSeals.set(true);
    try {
      const list = await firstValueFrom(this.seals.getIncomingByBank(this.selectedBankId)).catch(() => []);
      this.expected.set(list ?? []);
    } finally {
      this.loadingSeals.set(false);
    }
  }

  async startScan(): Promise<void> {
    if (this.scanning()) return;
    this.scanning.set(true);
    try {
      this.session = await this.scanner.startContinuous((value) => this.recordScan(value));
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

  private recordScan(raw: string): void {
    const match = this.expected().find(
      (s) => String(s.id) === raw.trim() || String(s.number) === raw.trim(),
    );
    if (match) {
      this.scannedIds.update((s) => new Set(s).add(String(match.id)));
    } else {
      this.unknownScans.update((u) => (u.includes(raw) ? u : [...u, raw]));
    }
  }

  async submit(): Promise<void> {
    if (!this.selectedBankId || this.submitting() || this.scannedCount() === 0) return;
    if (!this.connectivity.online()) {
      await this.showToast('Offline — submission will sync when connection returns.', 'warning');
    }
    await this.stopScan();
    this.submitting.set(true);
    try {
      const ids = Array.from(this.scannedIds()).concat(this.unknownScans());
      await this.seals.postIncomingByBank(this.selectedBankId, { sealIds: ids });
      await this.showToast('Seals submitted.', 'success');
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
