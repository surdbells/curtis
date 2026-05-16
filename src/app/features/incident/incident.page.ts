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
  imports: [CommonModule, IonicModule, FormsModule, OfflineBannerComponent],
  styles: [
    `
      :host { display: block; }
      ion-content { --background: var(--curtis-bg); }

      .sos-banner {
        margin: 0.75rem;
        padding: 0.85rem 1rem;
        border-radius: var(--curtis-radius-md);
        background: var(--ion-color-danger);
        color: var(--ion-color-danger-contrast);
        display: flex; align-items: center; gap: 0.5rem;
        font-weight: 600;
      }

      .severity-row {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 0.4rem;
        padding: 0 1rem 0.5rem;
      }
      .sev-btn {
        padding: 0.5rem 0.4rem;
        border-radius: var(--curtis-radius-sm);
        border: 1px solid var(--curtis-border);
        background: var(--curtis-surface-1);
        color: var(--curtis-text);
        font-weight: 600; font-size: 0.78rem;
        text-align: center;
        transition: transform 100ms ease-out;
      }
      .sev-btn:active { transform: scale(0.97); }
      .sev-btn.selected {
        border-color: transparent;
        color: var(--ion-color-primary-contrast);
      }
      .sev-btn.selected.low      { background: var(--ion-color-medium); }
      .sev-btn.selected.medium   { background: var(--ion-color-warning); color: var(--ion-color-warning-contrast); }
      .sev-btn.selected.high     { background: var(--ion-color-danger);  color: var(--ion-color-danger-contrast); }
      .sev-btn.selected.critical {
        background: var(--ion-color-danger);
        color: var(--ion-color-danger-contrast);
        box-shadow: 0 0 0 2px var(--ion-color-danger);
      }

      .photo {
        margin: 0.75rem;
        border-radius: var(--curtis-radius-md);
        background: var(--curtis-surface-1);
        border: 1px solid var(--curtis-border);
        overflow: hidden;
        min-height: 200px;
        display: flex; align-items: center; justify-content: center;
      }
      .photo img { width: 100%; display: block; }
      .photo .placeholder {
        color: var(--curtis-text-subtle); text-align: center; padding: 2rem;
      }

      .req-list {
        margin: 0.75rem;
        padding: 0.75rem 1rem;
        border-radius: var(--curtis-radius-md);
        background: var(--curtis-surface-1);
        border: 1px solid var(--curtis-border);
        font-size: 0.85rem;
      }
      .req-list .req {
        display: flex; align-items: center; gap: 0.5rem;
        padding: 0.25rem 0;
        color: var(--curtis-text-muted);
      }
      .req-list .req.met { color: var(--ion-color-success); }
      .req-list .req ion-icon { font-size: 1.1rem; }

      .actions { padding: 1rem; display: grid; gap: 0.5rem; }

      .stamp {
        font-size: 0.72rem;
        color: var(--curtis-text-subtle);
        padding: 0 1rem;
        margin-bottom: 0.5rem;
        font-variant-numeric: tabular-nums;
      }
    `,
  ],
  template: `
    <ion-header translucent>
      <ion-toolbar [color]="sosMode() ? 'danger' : undefined">
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/dashboard" />
        </ion-buttons>
        <ion-title>{{ sosMode() ? 'SOS — Report incident' : 'Report incident' }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <curtis-offline-banner />

      @if (sosMode()) {
        <div class="sos-banner">
          <ion-icon name="warning" />
          High-priority incident pre-filled — confirm details and submit.
        </div>
      }

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

      <div class="photo">
        @if (imageBase64()) {
          <img [src]="'data:image/jpeg;base64,' + imageBase64()" alt="Incident photo" />
        } @else {
          <div class="placeholder">
            <ion-icon name="camera-outline" style="font-size: 3rem;" />
            <p>Photo required — tap below to capture</p>
          </div>
        }
      </div>

      <ion-button expand="block" fill="outline" style="margin: 0 1rem;" (click)="capture()" [disabled]="submitting()">
        <ion-icon slot="start" name="camera-outline" />
        {{ imageBase64() ? 'Retake' : 'Capture' }} photo
      </ion-button>

      @if (locationFix(); as fix) {
        <div class="stamp" style="margin-top: 0.5rem;">
          <ion-icon name="location-outline" /> {{ fix.latitude.toFixed(5) }}, {{ fix.longitude.toFixed(5) }}
          @if (fix.accuracy) {
            · ±{{ fix.accuracy.toFixed(0) }}m
          }
        </div>
      } @else if (locationLoading()) {
        <div class="stamp"><ion-spinner name="dots" /> Acquiring location…</div>
      } @else {
        <div class="stamp" style="color: var(--ion-color-warning);">
          <ion-icon name="alert-circle-outline" /> Location unavailable — required
        </div>
      }

      <div class="req-list">
        <div class="req" [class.met]="!!typeId">
          <ion-icon [name]="typeId ? 'checkmark-circle' : 'ellipse-outline'" />
          Type selected
        </div>
        <div class="req" [class.met]="!!severity">
          <ion-icon [name]="severity ? 'checkmark-circle' : 'ellipse-outline'" />
          Severity selected
        </div>
        <div class="req" [class.met]="note.trim().length > 0">
          <ion-icon [name]="note.trim().length > 0 ? 'checkmark-circle' : 'ellipse-outline'" />
          Description added
        </div>
        <div class="req" [class.met]="!!imageBase64()">
          <ion-icon [name]="imageBase64() ? 'checkmark-circle' : 'ellipse-outline'" />
          Photo captured
        </div>
        <div class="req" [class.met]="!!locationFix()">
          <ion-icon [name]="locationFix() ? 'checkmark-circle' : 'ellipse-outline'" />
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
            <ion-icon slot="start" name="send" />
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
