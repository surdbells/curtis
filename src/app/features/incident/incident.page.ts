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
import { ActivatedRoute, Router } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

import { IncidentService } from '../../core/services/incident.service';
import { CameraService } from '../../core/services/camera.service';
import { LocationService } from '../../core/services/location.service';
import { ConnectivityService } from '../../core/services/connectivity.service';
import { OfflineBannerComponent } from '../../shared/components/offline-banner/offline-banner.component';
import { CurtisIconComponent } from '../../shared/components/icon';
import {
  INCIDENT_TYPES,
  INCIDENT_SEVERITIES,
  SOS_INCIDENT,
} from '../../core/models/incident.model';
import type { IncidentSeverity, IncidentType } from '../../core/models';

/**
 * Incident reporting — Phase 6.
 *
 * Required fields per Phase 6 decision: type, severity, photo, location, note.
 * The submit button stays disabled until all four resolve.
 *
 * SOS mode:
 *   When the page is opened with query param ?sos=1 (i.e. tapped from the
 *   Dashboard SOS button), the form is pre-filled with the highest-urgency
 *   defaults from SOS_INCIDENT — but the agent is still required to capture
 *   a photo before submission. This is a hard guard against an accidental
 *   pocket-tap firing a Robbery alert to dispatch.
 */
@Component({
  selector: 'curtis-incident',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule, FormsModule, OfflineBannerComponent, CurtisIconComponent],
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

      .sos-banner {
        margin: var(--curtis-space-3) var(--curtis-space-4);
        padding: var(--curtis-space-4);
        border-radius: var(--curtis-radius-lg);
        background: color-mix(in srgb, var(--ion-color-danger) 14%, transparent);
        color: var(--red-600);
        border: 1px solid color-mix(in srgb, var(--ion-color-danger) 30%, transparent);
        display: flex;
        gap: var(--curtis-space-3);
        align-items: center;
        font-weight: var(--curtis-weight-semibold);
        font-size: var(--curtis-text-sm);
      }
      .sos-banner__icon {
        width: 36px;
        height: 36px;
        border-radius: var(--curtis-radius-md);
        background: var(--red-500);
        color: #fff;
        display: grid;
        place-items: center;
        flex-shrink: 0;
        animation: pulse-red 1.6s var(--curtis-ease-in-out) infinite;
      }
      @keyframes pulse-red {
        0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); }
        50%      { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
      }

      .severity-row {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: var(--curtis-space-2);
        margin: 0 var(--curtis-space-4);
      }
      .sev-btn {
        padding: var(--curtis-space-3) var(--curtis-space-1);
        border-radius: var(--curtis-radius-md);
        border: 1px solid var(--curtis-border);
        background: var(--curtis-surface-1);
        color: var(--curtis-text-muted);
        font-family: var(--curtis-font-sans);
        font-weight: var(--curtis-weight-semibold);
        font-size: var(--curtis-text-xs);
        letter-spacing: var(--curtis-tracking-wide);
        text-transform: uppercase;
        text-align: center;
        cursor: pointer;
        transition: all var(--curtis-duration-fast) var(--curtis-ease-out);
      }
      .sev-btn:hover:not(.selected) {
        border-color: var(--curtis-border-strong);
        color: var(--curtis-text);
      }
      .sev-btn:active { transform: scale(0.97); }
      .sev-btn.selected {
        border-color: transparent;
        color: #fff;
        box-shadow: var(--curtis-shadow-sm);
      }
      .sev-btn.selected.low      { background: var(--slate-500); }
      .sev-btn.selected.medium   { background: var(--amber-500); color: #1A1A1A; }
      .sev-btn.selected.high     { background: var(--red-500); }
      .sev-btn.selected.critical {
        background: var(--red-600);
        box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.3), var(--curtis-shadow-sm);
      }

      .photo {
        margin: 0 var(--curtis-space-4);
        border-radius: var(--curtis-radius-lg);
        background: var(--curtis-surface-1);
        border: 1px solid var(--curtis-border);
        box-shadow: var(--curtis-shadow-xs);
        overflow: hidden;
        min-height: 200px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .photo img { width: 100%; display: block; object-fit: cover; }
      .photo .placeholder {
        display: flex;
        flex-direction: column;
        gap: var(--curtis-space-2);
        align-items: center;
        padding: var(--curtis-space-6);
        text-align: center;
      }
      .photo .placeholder__well {
        width: 64px;
        height: 64px;
        border-radius: var(--curtis-radius-xl);
        background: color-mix(in srgb, var(--ion-color-danger) 12%, transparent);
        color: var(--red-500);
        display: grid;
        place-items: center;
      }
      .photo .placeholder__text {
        font-size: var(--curtis-text-sm);
        color: var(--curtis-text-muted);
      }

      .capture-row {
        margin: var(--curtis-space-3) var(--curtis-space-4) 0;
      }

      .stamp {
        margin: var(--curtis-space-2) var(--curtis-space-5) 0;
        font-size: var(--curtis-text-xs);
        color: var(--curtis-text-subtle);
        font-variant-numeric: tabular-nums;
        display: flex;
        align-items: center;
        gap: var(--curtis-space-1);
      }
      .stamp--warn { color: var(--amber-500); }

      .req-list {
        margin: var(--curtis-space-3) var(--curtis-space-4);
        background: var(--curtis-surface-1);
        border: 1px solid var(--curtis-border);
        border-radius: var(--curtis-radius-lg);
        box-shadow: var(--curtis-shadow-xs);
        padding: var(--curtis-space-3) var(--curtis-space-4);
      }
      .req {
        display: flex;
        align-items: center;
        gap: var(--curtis-space-2);
        padding: var(--curtis-space-1_5) 0;
        font-size: var(--curtis-text-sm);
        color: var(--curtis-text-muted);
      }
      .req curtis-icon { color: var(--curtis-text-faint); }
      .req.met { color: var(--curtis-text); }
      .req.met curtis-icon { color: var(--green-600); }

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
    <ion-header [translucent]="true">
      <ion-toolbar [color]="sosMode() ? 'danger' : undefined">
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/dashboard"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ sosMode() ? 'SOS — Report incident' : 'Report incident' }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <curtis-offline-banner />

      @if (sosMode()) {
        <div class="sos-banner">
          <div class="sos-banner__icon">
            <curtis-icon name="warning" size="sm" />
          </div>
          <div>High-priority incident pre-filled — confirm details and submit.</div>
        </div>
      } @else {
        <div class="curtis-form-strip">
          <div class="curtis-form-strip__icon curtis-form-strip__icon--danger">
            <curtis-icon name="alert-circle-outline" size="md" />
          </div>
          <div class="curtis-form-strip__text">
            <div class="curtis-form-strip__title">Report an incident</div>
            <div class="curtis-form-strip__sub">Capture type, severity, and photo. Location is auto-attached.</div>
          </div>
        </div>
      }

      <div class="section-label">Incident type</div>
      <ion-list inset>
        <ion-item>
          <ion-select
            label="Incident type"
            labelPlacement="stacked"
            interface="action-sheet"
            [(ngModel)]="typeId"
            (ionChange)="onTypeChange()"
            [disabled]="submitting()"
          >
            @for (t of types; track t.id) {
              <ion-select-option [value]="t.id">{{ t.label }}</ion-select-option>
            }
          </ion-select>
        </ion-item>
      </ion-list>

      <div class="section-label">Severity</div>
      <div class="severity-row">
        @for (s of severities; track s.id) {
          <button
            type="button"
            class="sev-btn"
            [class.selected]="severity === s.id"
            [class.low]="s.id === 'low'"
            [class.medium]="s.id === 'medium'"
            [class.high]="s.id === 'high'"
            [class.critical]="s.id === 'critical'"
            (click)="severity = s.id"
            [disabled]="submitting()"
          >
            {{ s.label }}
          </button>
        }
      </div>

      <div class="section-label">Description</div>
      <ion-list inset>
        <ion-item>
          <ion-textarea
            label="Description"
            labelPlacement="stacked"
            placeholder="Describe what happened…"
            rows="3"
            autoGrow="true"
            [(ngModel)]="note"
            [disabled]="submitting()"
          />
        </ion-item>
      </ion-list>

      <div class="section-label">Photo evidence</div>
      <div class="photo">
        @if (imageBase64()) {
          <img [src]="'data:image/jpeg;base64,' + imageBase64()" alt="Incident photo" />
        } @else {
          <div class="placeholder">
            <div class="placeholder__well">
              <curtis-icon name="camera-outline" size="lg" [strokeWidth]="1.5" />
            </div>
            <div class="placeholder__text">Photo required — tap below to capture</div>
          </div>
        }
      </div>

      <div class="capture-row">
        <ion-button expand="block" fill="outline" (click)="capture()" [disabled]="submitting()">
          <curtis-icon slot="start" name="camera-outline" size="sm" />
          {{ imageBase64() ? 'Retake' : 'Capture' }} photo
        </ion-button>
      </div>

      @if (locationFix(); as fix) {
        <div class="stamp">
          <curtis-icon name="location-outline" size="xs" />
          {{ fix.latitude.toFixed(5) }}, {{ fix.longitude.toFixed(5) }}
          @if (fix.accuracy) {
            · ±{{ fix.accuracy.toFixed(0) }}m
          }
        </div>
      } @else if (locationLoading()) {
        <div class="stamp"><ion-spinner name="dots" /> Acquiring location…</div>
      } @else {
        <div class="stamp stamp--warn">
          <curtis-icon name="alert-circle-outline" size="xs" />
          Location unavailable — required
        </div>
      }

      <div class="section-label">Submission checklist</div>
      <div class="req-list">
        <div class="req" [class.met]="!!typeId">
          <curtis-icon [name]="typeId ? 'checkmark-circle' : 'ellipse-outline'" size="sm" />
          Type selected
        </div>
        <div class="req" [class.met]="!!severity">
          <curtis-icon [name]="severity ? 'checkmark-circle' : 'ellipse-outline'" size="sm" />
          Severity selected
        </div>
        <div class="req" [class.met]="note.trim().length > 0">
          <curtis-icon [name]="note.trim().length > 0 ? 'checkmark-circle' : 'ellipse-outline'" size="sm" />
          Description added
        </div>
        <div class="req" [class.met]="!!imageBase64()">
          <curtis-icon [name]="imageBase64() ? 'checkmark-circle' : 'ellipse-outline'" size="sm" />
          Photo captured
        </div>
        <div class="req" [class.met]="!!locationFix()">
          <curtis-icon [name]="locationFix() ? 'checkmark-circle' : 'ellipse-outline'" size="sm" />
          Location available
        </div>
      </div>

      <div class="actions">
        <ion-button
          expand="block"
          color="danger"
          [disabled]="!canSubmit() || submitting()"
          (click)="submit()"
        >
          @if (submitting()) {
            <ion-spinner slot="start" name="crescent" />
            Sending…
          } @else {
            <curtis-icon slot="start" name="send" size="sm" />
            Submit incident
          }
        </ion-button>
      </div>
    </ion-content>
  `,
})
export class IncidentPage implements OnInit {
  private readonly incidents = inject(IncidentService);
  private readonly camera = inject(CameraService);
  private readonly locationSvc = inject(LocationService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastController);

  protected readonly types = INCIDENT_TYPES;
  protected readonly severities = INCIDENT_SEVERITIES;

  protected readonly sosMode = signal(false);
  protected readonly submitting = signal(false);
  protected readonly imageBase64 = signal<string | null>(null);
  protected readonly locationFix = signal<{
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null>(null);
  protected readonly locationLoading = signal(false);

  protected typeId = '';
  protected severity: IncidentSeverity | '' = '';
  protected note = '';

  protected readonly canSubmit = computed(
    () =>
      !!this.typeId &&
      !!this.severity &&
      this.note.trim().length > 0 &&
      !!this.imageBase64() &&
      !!this.locationFix(),
  );

  async ngOnInit(): Promise<void> {
    // SOS pre-fill via query param.
    const sos = this.route.snapshot.queryParamMap.get('sos');
    if (sos === '1') {
      this.sosMode.set(true);
      this.typeId = SOS_INCIDENT.type;
      this.severity = SOS_INCIDENT.severity;
      this.note = SOS_INCIDENT.note;
    }
    void this.acquireLocation();
  }

  protected onTypeChange(): void {
    const t = this.types.find((x: IncidentType) => x.id === this.typeId);
    if (t && !this.severity) {
      this.severity = t.defaultSeverity;
    } else if (t) {
      // Also bump severity to the type's default unless the agent already
      // chose a higher one — soft guidance.
      const order: IncidentSeverity[] = ['low', 'medium', 'high', 'critical'];
      const current = this.severity ? order.indexOf(this.severity) : -1;
      const suggested = order.indexOf(t.defaultSeverity);
      if (suggested > current) this.severity = t.defaultSeverity;
    }
  }

  protected async capture(): Promise<void> {
    try {
      const b64 = await this.camera.capture({ quality: 70 });
      this.imageBase64.set(b64);
    } catch (err) {
      const msg = (err as { message?: string } | undefined)?.message;
      if (msg && !msg.toLowerCase().includes('cancel')) {
        await this.showToast(msg, 'danger');
      }
    }
  }

  protected async submit(): Promise<void> {
    if (!this.canSubmit() || this.submitting()) return;
    const offlineNote = !this.connectivity.online();
    this.submitting.set(true);
    try {
      await this.incidents.report({
        typeId: this.typeId,
        severity: this.severity as IncidentSeverity,
        note: this.note.trim(),
        imageBase64: this.imageBase64()!,
      });
      await this.haptic(NotificationType.Warning);
      await this.showToast(
        offlineNote
          ? 'Incident queued — will sync when connection returns.'
          : 'Incident submitted to dispatch.',
        'success',
      );
      await this.router.navigateByUrl('/dashboard', { replaceUrl: true });
    } catch (err) {
      await this.haptic(NotificationType.Error);
      await this.showToast(this.describeError(err, 'Submission failed.'), 'danger');
    } finally {
      this.submitting.set(false);
    }
  }

  private async acquireLocation(): Promise<void> {
    this.locationLoading.set(true);
    try {
      const fix = await this.locationSvc.getCurrent({ timeoutMs: 10_000, highAccuracy: true });
      this.locationFix.set({
        latitude: fix.latitude,
        longitude: fix.longitude,
        accuracy: fix.accuracy,
      });
    } catch {
      this.locationFix.set(null);
    } finally {
      this.locationLoading.set(false);
    }
  }

  private describeError(err: unknown, fallback: string): string {
    if (err && typeof err === 'object') {
      const e = err as { message?: string };
      if (typeof e.message === 'string' && e.message.trim()) return e.message;
    }
    return fallback;
  }

  private async haptic(type: NotificationType): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try { await Haptics.notification({ type }); } catch { /* ignore */ }
  }

  private async showToast(message: string, color: 'danger' | 'warning' | 'success') {
    const t = await this.toast.create({
      message, duration: 3000, position: 'top', color,
      buttons: [{ icon: 'close', role: 'cancel' }],
    });
    await t.present();
  }
}
