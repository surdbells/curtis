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
import { CurtisHeaderComponent } from '../../shared/components/header';
import { NIGERIAN_STATES } from '../../core/models/nigerian-states';
import type { ScanSession } from '../../core/services/scanner.service';
import type { Branch } from '../../core/models';

/**
 * Manual evacuation — Phase 5.
 *
 * Agent-initiated evacuation when the standard route flow doesn't apply.
 *
 * Origin + Destination both use the live /GetBranchesByState endpoint via
 * BankService (no XML fallback for branch lookup). Flow: pick state ->
 * branches load from server -> pick branch. Each branch carries its
 * bank id + name, so the bank picker is gone — we derive
 * `originationid` / `destinationbankid` from the selected branch when
 * submitting.
 *
 * Wire payload mirrors legacy ManualActivity field mappings (see
 * EvacuationService docs).
 */
@Component({
  selector: 'curtis-manual-evacuation',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule, FormsModule, OfflineBannerComponent, CurtisIconComponent, CurtisHeaderComponent],
  styles: [
    `
      :host { display: block; }
      ion-content {
        --background: var(--curtis-bg);
        /* Reserve scroll headroom so the Submit button always clears the
         * system nav / safe-area on phone-sized viewports. The form can
         * be long: origin + destination + details + seal list. */
        --padding-bottom: calc(var(--curtis-space-24) + env(safe-area-inset-bottom, 0));
      }
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
        display: flex;
        align-items: center;
        gap: var(--curtis-space-2);
      }
      .section-label__chip {
        background: color-mix(in srgb, var(--ion-color-success) 14%, transparent);
        color: var(--green-600);
        padding: 2px 8px;
        border-radius: var(--curtis-radius-pill);
        font-size: 10px;
        font-weight: var(--curtis-weight-bold);
        font-variant-numeric: tabular-nums;
        letter-spacing: var(--curtis-tracking-normal);
        text-transform: none;
      }

      .seal-card {
        margin: 0 var(--curtis-space-4);
        background: var(--curtis-surface-1);
        border: 1px solid var(--curtis-border);
        border-radius: var(--curtis-radius-lg);
        box-shadow: var(--curtis-shadow-xs);
        overflow: hidden;
      }
      .seal-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--curtis-space-2);
        padding: var(--curtis-space-2_5) var(--curtis-space-4);
        border-bottom: 1px solid var(--curtis-border);
      }
      .seal-row:last-child { border-bottom: none; }
      .seal-row code {
        font-family: var(--curtis-font-mono);
        font-size: var(--curtis-text-xs);
        color: var(--curtis-text);
        font-weight: var(--curtis-weight-semibold);
      }
      .seal-row ion-button { --padding-start: 0; --padding-end: 0; }
      .seals-empty {
        padding: var(--curtis-space-4);
        text-align: center;
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
    <curtis-header title="Manual evacuation" backHref="/dashboard" />

    <ion-content [fullscreen]="true">
      <curtis-offline-banner />

      <div class="curtis-form-strip">
        <div class="curtis-form-strip__icon curtis-form-strip__icon--tertiary">
          <curtis-icon name="document-text-outline" size="md" />
        </div>
        <div class="curtis-form-strip__text">
          <div class="curtis-form-strip__title">Manual evacuation</div>
          <div class="curtis-form-strip__sub">Pick origin and destination, scan seals, then submit.</div>
        </div>
      </div>

      <div class="section-label">Origin</div>
      <ion-list inset>
        <ion-item>
          <ion-select
            label="Origin state"
            labelPlacement="stacked"
            interface="action-sheet"
            [(ngModel)]="originState"
            (ionChange)="onOriginStateChange()"
            [disabled]="submitting()"
          >
            @for (s of states; track s) {
              <ion-select-option [value]="s">{{ s }}</ion-select-option>
            }
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-select
            label="Origin branch"
            labelPlacement="stacked"
            interface="action-sheet"
            [(ngModel)]="originBranchId"
            [disabled]="!originState || originBranches().length === 0 || submitting()"
          >
            @for (br of originBranches(); track br.id) {
              <ion-select-option [value]="br.id">
                {{ br.name }}{{ br.bankName ? ' — ' + br.bankName : '' }}
              </ion-select-option>
            }
          </ion-select>
        </ion-item>
      </ion-list>

      <div class="section-label">Destination</div>
      <ion-list inset>
        <ion-item>
          <ion-select
            label="Destination state"
            labelPlacement="stacked"
            interface="action-sheet"
            [(ngModel)]="destState"
            (ionChange)="onDestStateChange()"
            [disabled]="submitting()"
          >
            @for (s of states; track s) {
              <ion-select-option [value]="s">{{ s }}</ion-select-option>
            }
          </ion-select>
        </ion-item>
        <ion-item>
          <ion-select
            label="Destination branch"
            labelPlacement="stacked"
            interface="action-sheet"
            [(ngModel)]="destBranchId"
            [disabled]="!destState || destBranches().length === 0 || submitting()"
          >
            @for (br of destBranches(); track br.id) {
              <ion-select-option [value]="br.id">
                {{ br.name }}{{ br.bankName ? ' — ' + br.bankName : '' }}
              </ion-select-option>
            }
          </ion-select>
        </ion-item>
      </ion-list>

      <div class="section-label">Details</div>
      <ion-list inset>
        <ion-item>
          <ion-input
            label="Processing type"
            labelPlacement="stacked"
            [(ngModel)]="procType"
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

      <div class="section-label">
        Seals
        @if (sealIds().length > 0) {
          <span class="section-label__chip">{{ sealIds().length }}</span>
        }
      </div>

      @if (sealIds().length === 0) {
        <div class="seal-card">
          <div class="seals-empty">No seals scanned yet. Tap "Scan seals" to begin.</div>
        </div>
      } @else {
        <div class="seal-card">
          @for (id of sealIds(); track id) {
            <div class="seal-row">
              <code>{{ id }}</code>
              <ion-button fill="clear" size="small" color="medium" (click)="removeSeal(id)">
                <curtis-icon slot="icon-only" name="close-circle-outline" size="sm" />
              </ion-button>
            </div>
          }
        </div>
      }

      <div class="actions">
        @if (!scanning()) {
          <ion-button expand="block" fill="outline" (click)="startScan()" [disabled]="submitting()">
            <curtis-icon slot="start" name="qr-code-outline" size="sm" />
            Scan seals
          </ion-button>
        } @else {
          <ion-button expand="block" color="medium" (click)="stopScan()">
            <curtis-icon slot="start" name="close-outline" size="sm" />
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
            <curtis-icon slot="start" name="cloud-upload-outline" size="sm" />
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

  protected readonly states = NIGERIAN_STATES;
  protected readonly originBranches = signal<Branch[]>([]);
  protected readonly destBranches = signal<Branch[]>([]);
  protected readonly sealIds = signal<string[]>([]);
  protected readonly scanning = signal(false);
  protected readonly submitting = signal(false);
  protected readonly loadingOriginBranches = signal(false);
  protected readonly loadingDestBranches = signal(false);

  protected originState: string | null = null;
  protected originBranchId: string | null = null;
  protected destState: string | null = null;
  protected destBranchId: string | null = null;
  protected procType = '';
  protected note = '';

  private session?: ScanSession;

  protected readonly canSubmit = computed(
    () => !!this.originBranchId && this.sealIds().length > 0,
  );

  async ngOnInit(): Promise<void> {
    // No upfront load — branches load when the user picks a state.
  }

  async ngOnDestroy(): Promise<void> {
    await this.session?.stop();
    this.session = undefined;
  }

  async onOriginStateChange(): Promise<void> {
    this.originBranchId = null;
    if (!this.originState) {
      this.originBranches.set([]);
      return;
    }
    this.loadingOriginBranches.set(true);
    try {
      const list = await this.bankSvc.getBranchesByStateWithCache(this.originState, 'Bank');
      this.originBranches.set(list);
    } finally {
      this.loadingOriginBranches.set(false);
    }
  }

  async onDestStateChange(): Promise<void> {
    this.destBranchId = null;
    if (!this.destState) {
      this.destBranches.set([]);
      return;
    }
    this.loadingDestBranches.set(true);
    try {
      const list = await this.bankSvc.getBranchesByStateWithCache(this.destState, 'Bank');
      this.destBranches.set(list);
    } finally {
      this.loadingDestBranches.set(false);
    }
  }

  /** Look up the bank ID + name carried on the selected origin branch. */
  private originBranchRecord(): Branch | undefined {
    return this.originBranches().find((b) => b.id === this.originBranchId);
  }

  /** Look up the bank ID carried on the selected destination branch. */
  private destBranchRecord(): Branch | undefined {
    return this.destBranches().find((b) => b.id === this.destBranchId);
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

    const originBranch = this.originBranchRecord();
    const destBranch = this.destBranchRecord();
    if (!originBranch?.bankId) {
      await this.showToast('Origin branch is missing its bank id.', 'danger');
      return;
    }

    this.submitting.set(true);
    try {
      await this.evac.postManual({
        bankId: originBranch.bankId,
        branchId: originBranch.id,
        destinationBankId: destBranch?.bankId || undefined,
        destinationBranchId: destBranch?.id || undefined,
        procType: this.procType.trim() || undefined,
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
