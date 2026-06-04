import {
  Component,
  ChangeDetectionStrategy,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { Haptics, NotificationType, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

import { DeliveryStore } from '../../core/stores/delivery.store';
import { RouteStore } from '../../core/stores/route.store';
import { DayStore } from '../../core/stores/day.store';
import { DeliveryService } from '../../core/services/delivery.service';
import { BankService } from '../../core/services/bank.service';
import { ScannerService, type ScanSession } from '../../core/services/scanner.service';
import { OfflineBannerComponent } from '../../shared/components/offline-banner/offline-banner.component';
import { CurtisIconComponent } from '../../shared/components/icon';
import { CurtisHeaderComponent, CurtisHeaderStatusComponent } from '../../shared/components/header';
import { SealListComponent } from '../../shared/components/seal-list/seal-list.component';
import { ScanButtonComponent } from '../../shared/components/scan-button/scan-button.component';
import { SignaturePadComponent } from '../../shared/components/signature-pad/signature-pad.component';
import { NIGERIAN_STATES } from '../../core/models/nigerian-states';
import type { Seal, RouteStop, Bank, Branch } from '../../core/models';

/**
 * Process — the stop hub. All interaction with a single stop happens here:
 *
 *   Step 1. Check in   — pick bank + branch, optional note, POST /Check_In
 *   Step 2. Scan seals — match expected seals from the route
 *   Step 3. Sign       — agent + recipient signature  (added in E4)
 *   Step 4. Check out  — POST /check_out             (added in E4)
 *
 * This replaces the previous flow that split work across /delivery,
 * /process, /signature, and /delivery-checkout. The new design mirrors
 * legacy CurtisTracker ProcessActivity intent — one page per stop, with
 * check-in and check-out adjacent to the seal-scanning UI rather than
 * buried in a 3-dot menu.
 *
 * Sub-phase E3 (this commit) introduces Step 1 inline. Step 3 (signature)
 * and Step 4 (check-out) follow in sub-phase E4.
 *
 * Scanned-seals state is local to this page (not stored in DeliveryStore).
 * Backing out and re-entering starts the scan fresh.
 */
@Component({
  selector: 'curtis-process',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,
    OfflineBannerComponent,
    CurtisIconComponent,
    CurtisHeaderComponent,
    CurtisHeaderStatusComponent,
    SealListComponent,
    ScanButtonComponent,
    SignaturePadComponent,
  ],
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

      /* Stop summary — small card showing where the agent is. */
      .stop-summary {
        margin: var(--curtis-space-3) var(--curtis-space-4);
        padding: var(--curtis-space-4);
        background: var(--curtis-surface-1);
        border: 1px solid var(--curtis-border);
        border-radius: var(--curtis-radius-lg);
        box-shadow: var(--curtis-shadow-xs);
      }
      .stop-summary__title {
        font-size: var(--curtis-text-base);
        font-weight: var(--curtis-weight-bold);
        color: var(--curtis-text);
        margin-bottom: 2px;
        line-height: 1.3;
      }
      .stop-summary__sub {
        font-size: var(--curtis-text-sm);
        color: var(--curtis-text-muted);
        line-height: 1.35;
      }
      .stop-summary__meta {
        display: flex;
        gap: var(--curtis-space-3);
        margin-top: var(--curtis-space-2);
        flex-wrap: wrap;
        font-size: var(--curtis-text-xs);
        color: var(--curtis-text-subtle);
        font-variant-numeric: tabular-nums;
      }
      .stop-summary__meta span {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      /* Progress card — shows N / total seals counted. */
      .progress-card {
        margin: 0 var(--curtis-space-4) var(--curtis-space-3);
        padding: var(--curtis-space-4);
        background: var(--curtis-surface-1);
        border: 1px solid var(--curtis-border);
        border-radius: var(--curtis-radius-lg);
        box-shadow: var(--curtis-shadow-xs);
      }
      .progress-card__head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: var(--curtis-space-3);
      }
      .progress-card__label {
        font-size: var(--curtis-text-xs);
        font-weight: var(--curtis-weight-semibold);
        letter-spacing: var(--curtis-tracking-wider);
        text-transform: uppercase;
        color: var(--curtis-text-subtle);
      }
      .progress-card__counter {
        font-size: var(--curtis-text-2xl);
        font-weight: var(--curtis-weight-extrabold);
        font-variant-numeric: tabular-nums;
        color: var(--curtis-text);
        line-height: 1;
      }
      .progress-card__counter .total {
        font-size: var(--curtis-text-base);
        font-weight: var(--curtis-weight-semibold);
        color: var(--curtis-text-muted);
        margin-left: var(--curtis-space-1);
      }
      .progress-card__bar {
        height: 8px;
        background: var(--curtis-surface-2);
        border-radius: var(--curtis-radius-pill);
        overflow: hidden;
      }
      .progress-card__fill {
        height: 100%;
        background: linear-gradient(90deg, var(--green-500), var(--green-600));
        border-radius: var(--curtis-radius-pill);
        transition: width 300ms var(--curtis-ease-out);
      }

      /* Feedback strip — last scan result. */
      .feedback {
        margin: 0 var(--curtis-space-4) var(--curtis-space-3);
        padding: var(--curtis-space-3) var(--curtis-space-4);
        border-radius: var(--curtis-radius-md);
        font-size: var(--curtis-text-sm);
        display: flex;
        gap: var(--curtis-space-2);
        align-items: center;
        animation: fade-in var(--curtis-duration-fast) var(--curtis-ease-out);
      }
      .feedback--success {
        background: color-mix(in srgb, var(--ion-color-success) 12%, transparent);
        color: var(--green-600);
        border: 1px solid color-mix(in srgb, var(--ion-color-success) 26%, transparent);
      }
      .feedback--warning {
        background: color-mix(in srgb, var(--ion-color-warning) 14%, transparent);
        color: var(--amber-500);
        border: 1px solid color-mix(in srgb, var(--ion-color-warning) 30%, transparent);
      }
      .feedback--danger {
        background: color-mix(in srgb, var(--ion-color-danger) 12%, transparent);
        color: var(--red-500);
        border: 1px solid color-mix(in srgb, var(--ion-color-danger) 24%, transparent);
      }
      .feedback__code {
        font-family: var(--curtis-font-mono);
        font-weight: var(--curtis-weight-bold);
      }
      @keyframes fade-in {
        from { opacity: 0; transform: translateY(-2px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      .scan-actions {
        padding: 0 var(--curtis-space-4) var(--curtis-space-3);
        display: flex;
        flex-direction: column;
        gap: var(--curtis-space-2);
      }

      /* All-seals-confirmed banner, shown above the form. */
      .complete-banner {
        margin: var(--curtis-space-3) var(--curtis-space-4);
        padding: var(--curtis-space-3) var(--curtis-space-4);
        background: linear-gradient(135deg,
          color-mix(in srgb, var(--ion-color-success) 18%, transparent),
          color-mix(in srgb, var(--ion-color-success) 8%, transparent));
        border: 1px solid color-mix(in srgb, var(--ion-color-success) 36%, transparent);
        border-radius: var(--curtis-radius-md);
        font-size: var(--curtis-text-sm);
        font-weight: var(--curtis-weight-semibold);
        color: var(--green-600);
        display: flex;
        gap: var(--curtis-space-2);
        align-items: center;
      }

      /* --- Step indicator strip (Steps 1-2 in E3; 3-4 in E4) --- */
      .stepper {
        display: flex;
        gap: var(--curtis-space-2);
        margin: var(--curtis-space-3) var(--curtis-space-4) 0;
      }
      .step {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: var(--curtis-space-2) var(--curtis-space-1);
        border-radius: var(--curtis-radius-md);
        background: var(--curtis-surface-1);
        border: 1px solid var(--curtis-border);
        transition: border-color var(--curtis-duration-fast) var(--curtis-ease-out),
                    background var(--curtis-duration-fast) var(--curtis-ease-out);
      }
      .step__num {
        width: 22px; height: 22px;
        display: grid; place-items: center;
        border-radius: var(--curtis-radius-pill);
        background: var(--curtis-surface-2);
        color: var(--curtis-text-subtle);
        font-size: var(--curtis-text-xs);
        font-weight: var(--curtis-weight-bold);
      }
      .step__label {
        font-size: 11px;
        font-weight: var(--curtis-weight-semibold);
        color: var(--curtis-text-subtle);
        letter-spacing: var(--curtis-tracking-wide);
        text-transform: uppercase;
      }
      .step.is-active {
        border-color: var(--ion-color-primary);
        background: color-mix(in srgb, var(--ion-color-primary) 6%, var(--curtis-surface-1));
      }
      .step.is-active .step__num {
        background: var(--ion-color-primary);
        color: white;
      }
      .step.is-active .step__label {
        color: var(--curtis-text);
      }
      .step.is-done {
        border-color: color-mix(in srgb, var(--green-500) 50%, transparent);
        background: color-mix(in srgb, var(--green-500) 6%, var(--curtis-surface-1));
      }
      .step.is-done .step__num {
        background: var(--green-500);
        color: white;
      }
      .step.is-done .step__label {
        color: var(--green-600);
      }

      /* --- Check-in panel (Step 1) --- */
      .checkin-card {
        margin: var(--curtis-space-3) var(--curtis-space-4) var(--curtis-space-4);
        padding: var(--curtis-space-4);
        background: var(--curtis-surface-1);
        border: 1px solid var(--curtis-border);
        border-radius: var(--curtis-radius-lg);
        box-shadow: var(--curtis-shadow-xs);
        display: flex;
        flex-direction: column;
        gap: var(--curtis-space-3);
      }
      .checkin-card__heading {
        font-size: var(--curtis-text-base);
        font-weight: var(--curtis-weight-semibold);
        color: var(--curtis-text);
      }
      .checkin-card__sub {
        font-size: var(--curtis-text-sm);
        color: var(--curtis-text-subtle);
        margin-top: -10px;
      }
      .checkin-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .checkin-field__label {
        font-size: var(--curtis-text-xs);
        font-weight: var(--curtis-weight-semibold);
        color: var(--curtis-text-subtle);
        letter-spacing: var(--curtis-tracking-wide);
        text-transform: uppercase;
      }
      .checkin-field ion-select,
      .checkin-field ion-textarea,
      .checkin-field ion-input {
        --background: var(--curtis-surface-2);
        --color: var(--curtis-text);
        --placeholder-color: var(--curtis-text-faint);
        --padding-start: var(--curtis-space-3);
        --padding-end: var(--curtis-space-3);
        --padding-top: 10px;
        --padding-bottom: 10px;
        border-radius: var(--curtis-radius-md);
        border: 1px solid var(--curtis-border);
        font-size: var(--curtis-text-sm);
      }
      .checkin-submit {
        margin-top: var(--curtis-space-1);
      }

      /* --- Step 3 (Sign) + Step 4 (Check out) cards share the chrome --- */
      .sign-card,
      .checkout-card {
        margin: var(--curtis-space-3) var(--curtis-space-4) var(--curtis-space-4);
        padding: var(--curtis-space-4);
        background: var(--curtis-surface-1);
        border: 1px solid var(--curtis-border);
        border-radius: var(--curtis-radius-lg);
        box-shadow: var(--curtis-shadow-xs);
        display: flex;
        flex-direction: column;
        gap: var(--curtis-space-3);
      }
      .sign-card__heading,
      .checkout-card__heading {
        font-size: var(--curtis-text-base);
        font-weight: var(--curtis-weight-semibold);
        color: var(--curtis-text);
      }
      .sign-card__sub,
      .checkout-card__sub {
        font-size: var(--curtis-text-sm);
        color: var(--curtis-text-subtle);
        margin-top: -10px;
      }
      .sign-card__captured {
        display: flex;
        gap: var(--curtis-space-2);
        align-items: center;
        font-size: var(--curtis-text-sm);
        font-weight: var(--curtis-weight-semibold);
        color: var(--green-600);
      }

      /* Soft day-not-started warning (E3, per Q6). */
      .day-warning {
        margin: var(--curtis-space-3) var(--curtis-space-4) 0;
        padding: 10px var(--curtis-space-3);
        background: color-mix(in srgb, var(--amber-500) 12%, transparent);
        border: 1px solid color-mix(in srgb, var(--amber-500) 36%, transparent);
        border-radius: var(--curtis-radius-md);
        font-size: var(--curtis-text-sm);
        color: var(--curtis-text);
        display: flex;
        gap: var(--curtis-space-2);
        align-items: center;
      }
      .day-warning curtis-icon { color: var(--amber-500); }
    `,
  ],
  template: `
    <curtis-header title="Process" backHref="/delivery">
      @if (deliveryStore.isCheckedIn() && expectedCount() > 0) {
        <curtis-header-status
          slot="status"
          [variant]="scanComplete() ? 'success' : (scannedCount() > 0 ? 'info' : 'neutral')"
          [label]="scannedCount() + ' / ' + expectedCount()"
        />
      }
    </curtis-header>

    <ion-content [fullscreen]="true">
      <curtis-offline-banner />

      <!-- Stepper — top of page, always visible inside Process -->
      <div class="stepper">
        <div class="step" [class.is-active]="currentStep() === 1" [class.is-done]="currentStep() > 1">
          <span class="step__num">1</span>
          <span class="step__label">Check in</span>
        </div>
        <div class="step" [class.is-active]="currentStep() === 2" [class.is-done]="currentStep() > 2">
          <span class="step__num">2</span>
          <span class="step__label">Scan</span>
        </div>
        <div class="step" [class.is-active]="currentStep() === 3" [class.is-done]="currentStep() > 3">
          <span class="step__num">3</span>
          <span class="step__label">Sign</span>
        </div>
        <div class="step" [class.is-active]="currentStep() === 4">
          <span class="step__num">4</span>
          <span class="step__label">Check out</span>
        </div>
      </div>

      <!-- Soft warning if day hasn't started (per Q6) -->
      @if (!day.dayActive()) {
        <div class="day-warning">
          <curtis-icon name="alert-circle-outline" size="sm" />
          You haven't started your day. Return to Dashboard and tap Start day.
        </div>
      }

      <!-- STEP 1 — Check in -->
      @if (!deliveryStore.isCheckedIn()) {
        @if (activeStop(); as stop) {
          <div class="stop-summary">
            <div class="stop-summary__title">{{ stop.destination || stop.refNo }}</div>
            @if (stop.clientName) {
              <div class="stop-summary__sub">{{ stop.clientName }}</div>
            }
            <div class="stop-summary__meta">
              @if (stop.refNo) {
                <span><curtis-icon name="receipt-outline" size="xs" /> Ref {{ stop.refNo }}</span>
              }
              @if (stop.stopNumber) {
                <span><curtis-icon name="navigate-outline" size="xs" /> Stop #{{ stop.stopNumber }}</span>
              }
            </div>
          </div>
        }

        <section class="checkin-card">
          <div class="checkin-card__heading">Check in to this stop</div>
          <div class="checkin-card__sub">
            Pick the bank and branch you're delivering to, add an optional note,
            then check in to begin scanning seals.
          </div>

          <div class="checkin-field">
            <label class="checkin-field__label" for="ci-bank">Bank</label>
            <ion-select
              id="ci-bank"
              interface="action-sheet"
              placeholder="Select bank"
              [(ngModel)]="selectedBankId"
              [disabled]="loadingBanks() || checkInSubmitting()"
            >
              @for (b of banks(); track b.id) {
                <ion-select-option [value]="b.id">{{ b.name }}</ion-select-option>
              }
            </ion-select>
          </div>

          <div class="checkin-field">
            <label class="checkin-field__label" for="ci-state">State</label>
            <ion-select
              id="ci-state"
              interface="action-sheet"
              placeholder="Select state"
              [(ngModel)]="selectedState"
              (ionChange)="onStateChange()"
              [disabled]="checkInSubmitting()"
            >
              @for (s of states; track s) {
                <ion-select-option [value]="s">{{ s }}</ion-select-option>
              }
            </ion-select>
          </div>

          <div class="checkin-field">
            <label class="checkin-field__label" for="ci-branch">Branch</label>
            <ion-select
              id="ci-branch"
              interface="action-sheet"
              [placeholder]="selectedState ? 'Select branch' : 'Pick state first'"
              [(ngModel)]="selectedBranchId"
              [disabled]="!selectedState || loadingBranches() || checkInSubmitting()"
            >
              @for (br of branches(); track br.id) {
                <ion-select-option [value]="br.id">{{ br.name }}</ion-select-option>
              }
            </ion-select>
          </div>

          <div class="checkin-field">
            <label class="checkin-field__label" for="ci-note">Note (optional)</label>
            <ion-textarea
              id="ci-note"
              [(ngModel)]="checkInNote"
              [disabled]="checkInSubmitting()"
              placeholder="Anything the office should know"
              [autoGrow]="true"
              rows="2"
            />
          </div>

          <ion-button
            class="checkin-submit"
            expand="block"
            [disabled]="!canCheckIn() || checkInSubmitting()"
            (click)="doCheckIn()"
          >
            @if (checkInSubmitting()) {
              <ion-spinner slot="start" name="crescent" />
              Checking in…
            } @else {
              <curtis-icon slot="start" name="log-in-outline" size="sm" />
              Check in
            }
          </ion-button>
        </section>
      } @else {
        <div class="curtis-form-strip">
          <div class="curtis-form-strip__icon">2</div>
          <div class="curtis-form-strip__text">
            <div class="curtis-form-strip__title">Confirm seals at this stop</div>
            <div class="curtis-form-strip__sub">
              Scan each physical seal you're delivering, then record processing details.
            </div>
          </div>
        </div>

        @if (activeStop(); as stop) {
          <div class="stop-summary">
            <div class="stop-summary__title">{{ stop.destination || stop.refNo }}</div>
            @if (stop.clientName) {
              <div class="stop-summary__sub">{{ stop.clientName }}</div>
            }
            <div class="stop-summary__meta">
              @if (stop.refNo) {
                <span>
                  <curtis-icon name="receipt-outline" size="xs" />
                  Ref {{ stop.refNo }}
                </span>
              }
              @if (stop.stopNumber) {
                <span>
                  <curtis-icon name="navigate-outline" size="xs" />
                  Stop #{{ stop.stopNumber }}
                </span>
              }
              @if (stop.status) {
                <span>
                  <curtis-icon name="time-outline" size="xs" />
                  {{ stop.status }}
                </span>
              }
            </div>
          </div>
        }

        @if (expectedCount() > 0) {
          <div class="section-label">Scan progress</div>
          <div class="progress-card">
            <div class="progress-card__head">
              <span class="progress-card__label">Confirmed</span>
              <span class="progress-card__counter">
                {{ scannedCount() }}<span class="total"> / {{ expectedCount() }}</span>
              </span>
            </div>
            <div class="progress-card__bar">
              <div class="progress-card__fill" [style.width.%]="progressPct()"></div>
            </div>
          </div>
        } @else {
          <div class="section-label">Scan</div>
          <div class="progress-card">
            <div class="progress-card__head">
              <span class="progress-card__label">No expected seals</span>
              <span class="progress-card__counter">{{ scannedCount() }}</span>
            </div>
            <div class="stop-summary__sub">
              The route data didn't include a seal list for this stop. Scan anything you're
              delivering — it will be recorded with the processing entry.
            </div>
          </div>
        }

        @if (lastFeedback(); as fb) {
          <div class="feedback" [class.feedback--success]="fb.kind === 'success'"
                                [class.feedback--warning]="fb.kind === 'warning'"
                                [class.feedback--danger]="fb.kind === 'danger'">
            <curtis-icon
              [name]="fb.kind === 'success' ? 'checkmark-circle-outline'
                : fb.kind === 'warning' ? 'information-circle-outline'
                : 'alert-circle-outline'"
              size="sm"
            />
            <span>
              <span class="feedback__code">{{ fb.code }}</span>
              — {{ fb.message }}
            </span>
          </div>
        }

        @if (expectedCount() > 0) {
          <div class="section-label">Seals</div>
          <curtis-seal-list [seals]="display()" />
        }

        <div class="scan-actions">
          @if (!scanning() && !scanComplete()) {
            <curtis-scan-button label="Scan seal" (scan)="startScan()" />
          } @else if (scanning()) {
            <ion-button color="medium" expand="block" (click)="stopScan()">
              <curtis-icon slot="start" name="close-outline" size="sm" />
              Stop scanning
            </ion-button>
          }
        </div>

        @if (scanComplete()) {
          <div class="complete-banner">
            <curtis-icon name="checkmark-circle-outline" size="sm" />
            All expected seals confirmed. Record processing details below.
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
            <ion-button expand="block" [disabled]="submitting() || deliveryStore.processComplete()" (click)="submit()">
              @if (submitting()) {
                <ion-spinner slot="start" name="crescent" />
                Recording…
              } @else if (deliveryStore.processComplete()) {
                <curtis-icon slot="start" name="checkmark-outline" size="sm" />
                Processing saved
              } @else {
                Save & continue
                <curtis-icon slot="end" name="arrow-forward-outline" size="sm" />
              }
            </ion-button>
          </div>
        }

        <!-- STEP 3 — Sign -->
        @if (deliveryStore.processComplete() && !deliveryStore.hasSignature()) {
          <section class="sign-card">
            <div class="sign-card__heading">Capture signature</div>
            <div class="sign-card__sub">
              Hand the device to the recipient. They sign below to confirm delivery.
            </div>

            <curtis-signature-pad (end)="onSignatureCaptured($event)" />

            <ion-button
              expand="block"
              [disabled]="!lastSignatureDataUrl() || signatureSubmitting()"
              (click)="saveSignature()"
            >
              @if (signatureSubmitting()) {
                <ion-spinner slot="start" name="crescent" />
                Saving signature…
              } @else {
                <curtis-icon slot="start" name="create-outline" size="sm" />
                Save signature
              }
            </ion-button>
          </section>
        }

        <!-- STEP 4 — Check out -->
        @if (deliveryStore.canCheckOut() && !deliveryStore.checkOutAt()) {
          <section class="checkout-card">
            <div class="checkout-card__heading">Check out</div>
            <div class="checkout-card__sub">
              Signature recorded. Confirm check-out to close this stop.
            </div>

            <div class="sign-card__captured">
              <curtis-icon name="checkmark-circle-outline" size="sm" />
              Signature on file
            </div>

            <div class="checkin-field">
              <label class="checkin-field__label" for="co-note">Closing note (optional)</label>
              <ion-textarea
                id="co-note"
                [(ngModel)]="checkOutNote"
                [disabled]="checkOutSubmitting()"
                placeholder="Anything to flag at this stop"
                [autoGrow]="true"
                rows="2"
              />
            </div>

            <ion-button
              expand="block"
              color="success"
              [disabled]="checkOutSubmitting()"
              (click)="doCheckOut()"
            >
              @if (checkOutSubmitting()) {
                <ion-spinner slot="start" name="crescent" />
                Checking out…
              } @else {
                <curtis-icon slot="start" name="log-out-outline" size="sm" />
                Confirm check-out
              }
            </ion-button>
          </section>
        }
      }
    </ion-content>
  `,
})
export class ProcessPage implements OnInit, OnDestroy {
  protected readonly deliveryStore = inject(DeliveryStore);
  protected readonly routeStore = inject(RouteStore);
  protected readonly day = inject(DayStore);
  private readonly deliverySvc = inject(DeliveryService);
  private readonly banksSvc = inject(BankService);
  private readonly scanner = inject(ScannerService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastController);

  protected readonly submitting = signal(false);
  protected readonly scanning = signal(false);

  // --- Step 1 (Check-in) state -----------------------------------------------
  protected readonly states = NIGERIAN_STATES;
  protected readonly banks = signal<Bank[]>([]);
  protected readonly branches = signal<Branch[]>([]);
  protected readonly loadingBanks = signal(false);
  protected readonly loadingBranches = signal(false);
  protected readonly checkInSubmitting = signal(false);

  protected selectedBankId: string | null = null;
  protected selectedState: string | null = null;
  protected selectedBranchId: string | null = null;
  protected checkInNote = '';
  // ---------------------------------------------------------------------------

  // --- Step 3 (Sign) + Step 4 (Check-out) state ------------------------------
  /** Most recent data-URL emitted by <curtis-signature-pad>. Cleared after save. */
  protected readonly lastSignatureDataUrl = signal<string | null>(null);
  protected readonly signatureSubmitting = signal(false);
  protected readonly checkOutSubmitting = signal(false);
  protected checkOutNote = '';
  // ---------------------------------------------------------------------------

  /** Scanned seal IDs, local to this page. De-duplicated on insert. */
  protected readonly localScanned = signal<readonly string[]>([]);

  /** Last scan result for the feedback strip. */
  protected readonly lastFeedback = signal<
    { kind: 'success' | 'warning' | 'danger'; code: string; message: string } | null
  >(null);

  protected processingType = '';
  protected procType = '';
  protected note = '';

  /** The active stop, resolved by matching DeliveryStore.stopId against RouteStore.stops. */
  protected readonly activeStop = computed<RouteStop | null>(() => {
    const id = this.deliveryStore.stopId();
    if (!id) return null;
    return this.routeStore.stops().find((s) => s.referenceNumber === id) ?? null;
  });

  /** Expected seals from the active stop. Always a defined array. */
  protected readonly expectedSeals = computed<readonly string[]>(
    () => this.activeStop()?.seals ?? [],
  );

  protected readonly expectedCount = computed(() => this.expectedSeals().length);
  protected readonly scannedCount = computed(() => this.localScanned().length);

  /**
   * Scan complete when:
   *   - The route had expected seals and all have been counted, OR
   *   - The route had no expected seals (data gap) and at least one was scanned
   *
   * If neither applies, the form stays hidden — agent must scan first.
   */
  protected readonly scanComplete = computed(() => {
    const expected = this.expectedSeals();
    if (expected.length === 0) return this.scannedCount() > 0;
    const scanned = new Set(this.localScanned());
    return expected.every((id) => scanned.has(id));
  });

  protected readonly progressPct = computed(() => {
    const total = this.expectedSeals().length;
    if (total === 0) return 0;
    return Math.min(100, Math.round((this.scannedCount() / total) * 100));
  });

  /**
   * Which step the agent is currently on, 1-4. Drives the stepper UI.
   * In E3 we model steps 1 (Check in) and 2 (Scan). Steps 3 (Sign) and
   * 4 (Check out) are placeholders until E4 lands.
   */
  protected readonly currentStep = computed<1 | 2 | 3 | 4>(() => {
    if (!this.deliveryStore.isCheckedIn()) return 1;
    if (!this.scanComplete()) return 2;
    if (!this.deliveryStore.hasSignature()) return 3;
    return 4;
  });

  /**
   * Composed list for <curtis-seal-list> — every expected seal becomes
   * a row with status 'scanned' or 'pending'. Unexpected scans (the
   * agent scanned something not in the expected list) are appended.
   */
  protected readonly display = computed<Seal[]>(() => {
    const scanned = new Set(this.localScanned());
    const expectedRows: Seal[] = this.expectedSeals().map((id) => ({
      id,
      number: id,
      status: scanned.has(id) ? 'scanned' : 'pending',
    }));
    const expectedSet = new Set(this.expectedSeals());
    const extraRows: Seal[] = this.localScanned()
      .filter((id) => !expectedSet.has(id))
      .map((id) => ({ id, number: id, status: 'scanned' }));
    return [...expectedRows, ...extraRows];
  });

  private session?: ScanSession;

  async ngOnInit(): Promise<void> {
    // Pre-fill the check-in panel from DeliveryStore (populated when the
    // agent tapped a stop on the Delivery list or arrived via deep link).
    this.selectedBankId = this.deliveryStore.bankId();
    this.selectedBranchId = this.deliveryStore.branchId();
    this.selectedState = this.deliveryStore.state();

    // If not yet checked in, hydrate the bank/branch pickers.
    if (!this.deliveryStore.isCheckedIn()) {
      await this.loadBanks();
      if (this.selectedState) {
        await this.loadBranches(this.selectedState);
      }
    }
  }

  // --- Step 1 (Check-in) methods --------------------------------------------

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
      const list = await this.banksSvc.getBanksWithCache();
      this.banks.set(list);
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

  protected async doCheckIn(): Promise<void> {
    if (!this.canCheckIn() || this.checkInSubmitting()) return;

    const bankId = String(this.selectedBankId);
    const branchId = String(this.selectedBranchId);

    this.deliveryStore.setBankBranch({
      bankId,
      branchId,
      state: this.selectedState,
    });

    this.checkInSubmitting.set(true);
    try {
      await this.deliverySvc.checkIn({
        bankId,
        branchId,
        note: this.checkInNote.trim() || undefined,
      });
      await this.haptic('success');
      await this.showToast('Checked in. You can scan seals now.', 'success');
    } catch (err) {
      await this.haptic('error');
      await this.showToast(this.describeError(err, 'Check-in failed.'), 'danger');
    } finally {
      this.checkInSubmitting.set(false);
    }
  }

  // ---------------------------------------------------------------------------

  async ngOnDestroy(): Promise<void> {
    await this.session?.stop();
    this.session = undefined;
  }

  async startScan(): Promise<void> {
    if (this.scanning()) return;
    if (this.scanComplete()) return;
    this.scanning.set(true);
    try {
      this.session = await this.scanner.startContinuous((value) => this.recordScan(value));
    } catch (err) {
      this.scanning.set(false);
      const msg = err instanceof Error ? err.message : 'Could not start scanner.';
      await this.showToast(msg, 'danger');
    }
  }

  async stopScan(): Promise<void> {
    await this.session?.stop();
    this.session = undefined;
    this.scanning.set(false);
  }

  /**
   * Classify a single scan against the expected list. Mirrors legacy
   * ProcessActivity / RouteActivity / BankActivity behaviour: each scan
   * is either confirmed, already-counted, or not found.
   */
  private recordScan(raw: string): void {
    const id = raw.trim();
    if (!id) return;

    const expected = this.expectedSeals();
    const already = this.localScanned();

    // Branch 1: matches expected and is new.
    if (expected.includes(id) && !already.includes(id)) {
      this.localScanned.update((arr) => [...arr, id]);
      this.lastFeedback.set({
        kind: 'success',
        code: id,
        message: 'Confirmed successfully',
      });
      void this.haptic('success');

      // Auto-stop the scanner once everything is counted, so the agent
      // doesn't keep the camera burning while filling the form.
      if (this.scanComplete()) {
        void this.stopScan();
      }
      return;
    }

    // Branch 2: matches expected but already counted.
    if (expected.includes(id) && already.includes(id)) {
      this.lastFeedback.set({
        kind: 'warning',
        code: id,
        message: 'Already counted',
      });
      void this.haptic('tap');
      return;
    }

    // Branch 3: route had no expected list — accept anything as a scan.
    if (expected.length === 0 && !already.includes(id)) {
      this.localScanned.update((arr) => [...arr, id]);
      this.lastFeedback.set({
        kind: 'success',
        code: id,
        message: 'Recorded',
      });
      void this.haptic('success');
      return;
    }

    // Branch 4: route had no expected list and this id was already scanned.
    if (expected.length === 0 && already.includes(id)) {
      this.lastFeedback.set({
        kind: 'warning',
        code: id,
        message: 'Already counted',
      });
      void this.haptic('tap');
      return;
    }

    // Branch 5: scanned something not in the expected list.
    this.lastFeedback.set({
      kind: 'danger',
      code: id,
      message: 'Not found, please confirm',
    });
    void this.haptic('error');
  }

  protected async submit(): Promise<void> {
    if (this.submitting()) return;
    if (!this.scanComplete()) return;
    this.submitting.set(true);
    try {
      await this.stopScan();
      // Legacy wire convention: seals as a single comma-separated string.
      const sealsCsv = this.localScanned().filter(Boolean).join(',');
      await this.deliverySvc.postProcess({
        processingType: this.processingType.trim() || undefined,
        procType: this.procType.trim() || undefined,
        seals: sealsCsv || undefined,
        note: this.note.trim() || undefined,
      });
      this.deliveryStore.markProcessComplete();
      // Flow continues inline — the stepper advances to Step 3 (Sign) and
      // the signature card unfolds below. No navigation.
      await this.haptic('success');
    } catch (err) {
      await this.showToast(this.describeError(err, 'Could not save process details.'), 'danger');
    } finally {
      this.submitting.set(false);
    }
  }

  // --- Step 3 (Sign) methods -------------------------------------------------

  /** Called every time the recipient lifts their finger on the signature pad. */
  protected onSignatureCaptured(dataUrl: string): void {
    this.lastSignatureDataUrl.set(dataUrl || null);
  }

  protected async saveSignature(): Promise<void> {
    const dataUrl = this.lastSignatureDataUrl();
    if (!dataUrl || this.signatureSubmitting()) return;
    this.signatureSubmitting.set(true);
    try {
      await this.deliverySvc.postSignature(dataUrl);
      this.deliveryStore.setSignature(dataUrl);
      await this.haptic('success');
      await this.showToast('Signature saved.', 'success');
    } catch (err) {
      await this.haptic('error');
      await this.showToast(this.describeError(err, 'Could not save signature.'), 'danger');
    } finally {
      this.signatureSubmitting.set(false);
    }
  }

  // --- Step 4 (Check-out) methods --------------------------------------------

  protected async doCheckOut(): Promise<void> {
    if (this.checkOutSubmitting()) return;
    if (!this.deliveryStore.canCheckOut()) return;
    this.checkOutSubmitting.set(true);
    try {
      await this.deliverySvc.checkOut({
        note: this.checkOutNote.trim() || undefined,
      });
      await this.haptic('success');
      await this.showToast('Checked out. Stop complete.', 'success');
      // Reset local state so re-entering /process for the next stop starts fresh.
      this.deliveryStore.clear();
      this.localScanned.set([]);
      this.lastSignatureDataUrl.set(null);
      this.checkOutNote = '';
      this.note = '';
      this.processingType = '';
      this.procType = '';
      // Per Q4: navigate to Dashboard after check-out.
      await this.router.navigateByUrl('/dashboard', { replaceUrl: true });
    } catch (err) {
      await this.haptic('error');
      await this.showToast(this.describeError(err, 'Could not check out.'), 'danger');
    } finally {
      this.checkOutSubmitting.set(false);
    }
  }
  // ---------------------------------------------------------------------------

  private async haptic(kind: 'success' | 'tap' | 'error'): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      if (kind === 'success') {
        await Haptics.notification({ type: NotificationType.Success });
      } else if (kind === 'error') {
        await Haptics.notification({ type: NotificationType.Error });
      } else {
        await Haptics.impact({ style: ImpactStyle.Light });
      }
    } catch {
      // Haptics unavailable — silently ignore.
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
