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
import { AlertController, IonicModule, ToastController } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';

import { SessionStore } from '../../core/stores/session.store';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService, type ThemePreference } from '../../core/services/theme.service';
import { ConfigService } from '../../core/services/config.service';
import { PushService } from '../../core/services/push.service';
import { OnboardingService } from '../../core/services/onboarding.service';
import { OfflineQueueService } from '../../core/services/offline-queue.service';
import { TruckStore } from '../../core/stores/truck.store';
import { RouteStore } from '../../core/stores/route.store';
import { ErrorReportingService } from '../../core/services/error-reporting.service';

/**
 * Settings page — Phase 8 Commit 4.
 *
 * Surfaces:
 *   - Profile: user identity and log-out.
 *   - Theme: system / light / dark override.
 *   - GPS: ping interval slider (15s..5min).
 *   - Notifications: push permission + registration status, retry CTA.
 *   - Diagnostics: app version, env, device info, queue counts, push token.
 *   - Battery (Android): re-open settings, reset onboarding.
 *   - About: brand attribution, error-reporting status.
 *
 * Routed at /settings, auth-guarded only.
 */
import { CurtisIconComponent } from '../../shared/components/icon';

@Component({
  selector: 'curtis-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule, FormsModule, CurtisIconComponent],
  styles: [
    `
      :host { display: block; }
      ion-content { --background: var(--curtis-bg); }
      ion-list { background: transparent; }

      .section-header {
        margin: 1.25rem 1rem 0.4rem;
        font-size: 0.72rem; font-weight: 700;
        letter-spacing: 0.08em; text-transform: uppercase;
        color: var(--curtis-text-subtle);
      }

      .card-list {
        margin: 0 0.75rem;
        background: var(--curtis-surface-1);
        border: 1px solid var(--curtis-border);
        border-radius: var(--curtis-radius-md);
        box-shadow: var(--curtis-shadow-sm);
        overflow: hidden;
      }
      .card-list ion-item {
        --background: transparent;
        --border-color: var(--curtis-border);
      }
      .card-list ion-item:last-child { --border-color: transparent; }

      .kv-row {
        display: flex; justify-content: space-between; align-items: center;
        padding: 0.7rem 1rem;
        border-bottom: 1px solid var(--curtis-border);
        gap: 0.5rem;
      }
      .kv-row:last-child { border-bottom: none; }
      .kv-row .key {
        font-size: 0.85rem;
        color: var(--curtis-text-muted);
      }
      .kv-row .value {
        font-weight: 600;
        font-size: 0.85rem;
        text-align: right;
        max-width: 60%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--curtis-text);
        font-variant-numeric: tabular-nums;
      }
      .kv-row .value.mono {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 0.78rem;
      }
      .kv-row .value.ok      { color: var(--ion-color-success-shade); }
      .kv-row .value.warn    { color: var(--ion-color-warning-shade); }
      .kv-row .value.bad     { color: var(--ion-color-danger); }

      .seg-wrap { padding: 0.6rem 0.75rem; }
      ion-segment { --background: var(--curtis-surface-2); border-radius: var(--curtis-radius-pill); }

      .slider-row { padding: 0.6rem 1rem; }
      .slider-row ion-range { --bar-background: var(--curtis-border); }
      .slider-meta {
        display: flex; justify-content: space-between;
        font-size: 0.72rem;
        color: var(--curtis-text-subtle);
        padding: 0 0.3rem;
      }

      .actions-row { padding: 0.7rem 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap; }
      .actions-row ion-button { --border-radius: 8px; height: 34px; font-size: 0.82rem; }

      .footer {
        padding: 2rem 1rem 1rem;
        text-align: center;
        color: var(--curtis-text-subtle);
        font-size: 0.72rem;
      }
      .footer .brand {
        font-weight: 700; letter-spacing: 0.16em; color: var(--curtis-text-muted);
      }
    `,
  ],
  template: `
    <ion-header translucent>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/dashboard" />
        </ion-buttons>
        <ion-title>Settings</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <!-- =================== Profile =================== -->
      <div class="section-header">Profile</div>
      <div class="card-list">
        @if (session.user(); as u) {
          <div class="kv-row">
            <span class="key">Signed in as</span>
            <span class="value">{{ u.email || u.id }}</span>
          </div>
          <div class="kv-row">
            <span class="key">User ID</span>
            <span class="value mono">{{ short(u.id) }}</span>
          </div>
        } @else {
          <div class="kv-row">
            <span class="key">Status</span>
            <span class="value bad">Not signed in</span>
          </div>
        }
        @if (truck.truck(); as t) {
          <div class="kv-row">
            <span class="key">Truck</span>
            <span class="value">{{ t.plate || t.id }}</span>
          </div>
        }
        @if (route.route(); as r) {
          <div class="kv-row">
            <span class="key">Route</span>
            <span class="value">{{ r.name || r.id }}</span>
          </div>
        }
        <div class="actions-row">
          <ion-button color="danger" fill="outline" size="small" (click)="confirmLogout()">
            <curtis-icon slot="start" name="log-out-outline" />
            Sign out
          </ion-button>
        </div>
      </div>

      <!-- =================== Appearance =================== -->
      <div class="section-header">Appearance</div>
      <div class="card-list">
        <div class="seg-wrap">
          <ion-segment
            [value]="theme.preference()"
            (ionChange)="onThemeChange($event)"
          >
            <ion-segment-button value="system">
              <curtis-icon name="phone-portrait-outline" />
              <ion-label>System</ion-label>
            </ion-segment-button>
            <ion-segment-button value="light">
              <curtis-icon name="sunny-outline" />
              <ion-label>Light</ion-label>
            </ion-segment-button>
            <ion-segment-button value="dark">
              <curtis-icon name="moon-outline" />
              <ion-label>Dark</ion-label>
            </ion-segment-button>
          </ion-segment>
        </div>
        <div class="kv-row">
          <span class="key">Current</span>
          <span class="value">{{ theme.scheme() }}</span>
        </div>
      </div>

      <!-- =================== Tracking =================== -->
      <div class="section-header">Location tracking</div>
      <div class="card-list">
        <div class="slider-row">
          <div class="kv-row" style="padding: 0; border: none;">
            <span class="key">GPS ping interval</span>
            <span class="value">{{ intervalSec() }} s</span>
          </div>
          <ion-range
            [min]="config.gpsIntervalMin"
            [max]="config.gpsIntervalMax"
            [step]="5000"
            snaps="true"
            [(ngModel)]="intervalMs"
            (ionChange)="onIntervalChange()"
          />
          <div class="slider-meta">
            <span>15s (high res, more battery)</span>
            <span>5m (low res, save battery)</span>
          </div>
        </div>
        <div class="actions-row">
          <ion-button fill="clear" size="small" (click)="resetInterval()">
            <curtis-icon slot="start" name="refresh-outline" />
            Reset to default
          </ion-button>
        </div>
      </div>

      <!-- =================== Notifications =================== -->
      <div class="section-header">Notifications</div>
      <div class="card-list">
        <div class="kv-row">
          <span class="key">Permission</span>
          <span
            class="value"
            [class.ok]="push.permission() === 'granted'"
            [class.bad]="push.permission() === 'denied'"
            [class.warn]="push.permission() === 'unknown'"
          >
            {{ push.permission() }}
          </span>
        </div>
        <div class="kv-row">
          <span class="key">Registered</span>
          <span class="value" [class.ok]="push.registered()" [class.bad]="!push.registered()">
            {{ push.registered() ? 'Yes' : 'No' }}
          </span>
        </div>
        @if (push.token(); as t) {
          <div class="kv-row">
            <span class="key">Token</span>
            <span class="value mono">{{ short(t) }}</span>
          </div>
        }
        <div class="actions-row">
          <ion-button size="small" fill="outline" (click)="reregister()">
            <curtis-icon slot="start" name="cloud-upload-outline" />
            Re-register
          </ion-button>
        </div>
      </div>

      <!-- =================== Battery (Android only) =================== -->
      @if (isAndroid()) {
        <div class="section-header">Background activity</div>
        <div class="card-list">
          <div class="kv-row">
            <span class="key">Battery optimisation</span>
            <span class="value">Managed by Android</span>
          </div>
          <div class="actions-row">
            <ion-button size="small" fill="outline" (click)="openBatterySettings()">
              <curtis-icon slot="start" name="battery-charging-outline" />
              Open battery settings
            </ion-button>
            <ion-button size="small" fill="clear" color="medium" (click)="reopenOnboarding()">
              <curtis-icon slot="start" name="information-circle-outline" />
              Show onboarding again
            </ion-button>
          </div>
        </div>
      }

      <!-- =================== Diagnostics =================== -->
      <div class="section-header">Diagnostics</div>
      <div class="card-list">
        <div class="kv-row">
          <span class="key">Version</span>
          <span class="value mono">{{ version }}</span>
        </div>
        <div class="kv-row">
          <span class="key">Environment</span>
          <span class="value mono">{{ config.env }}</span>
        </div>
        <div class="kv-row">
          <span class="key">API base</span>
          <span class="value mono">{{ short(config.apiBaseUrl, 32) }}</span>
        </div>
        <div class="kv-row">
          <span class="key">Platform</span>
          <span class="value mono">{{ platform }}</span>
        </div>
        <div class="kv-row">
          <span class="key">Device ID</span>
          <span class="value mono">{{ short(deviceId() ?? '—') }}</span>
        </div>
        <div class="kv-row">
          <span class="key">Pending syncs</span>
          <span
            class="value"
            [class.ok]="queue.pendingCount() === 0 && queue.deadLetterCount() === 0"
            [class.warn]="queue.pendingCount() > 0 && queue.deadLetterCount() === 0"
            [class.bad]="queue.deadLetterCount() > 0"
          >
            {{ queue.pendingCount() }} pending,
            {{ queue.deadLetterCount() }} failed
          </span>
        </div>
        <div class="kv-row">
          <span class="key">Error reporting</span>
          <span class="value" [class.ok]="errors.enabled()" [class.warn]="!errors.enabled()">
            {{ errors.enabled() ? 'Active' : 'No DSN configured' }}
          </span>
        </div>
        <div class="actions-row">
          <ion-button size="small" fill="outline" (click)="goToQueue()">
            <curtis-icon slot="start" name="list-outline" />
            Sync queue
          </ion-button>
          <ion-button size="small" fill="clear" color="medium" (click)="copyDiagnostics()">
            <curtis-icon slot="start" name="copy-outline" />
            Copy diagnostics
          </ion-button>
        </div>
      </div>

      <div class="footer">
        <div class="brand">CURTIS</div>
        <div>Currency Tracking and Information System</div>
        <div style="margin-top: 0.4rem;">v{{ version }} · build {{ buildNumber }}</div>
      </div>
    </ion-content>
  `,
})
export class SettingsPage implements OnInit {
  protected readonly session = inject(SessionStore);
  protected readonly theme = inject(ThemeService);
  protected readonly config = inject(ConfigService);
  protected readonly push = inject(PushService);
  protected readonly queue = inject(OfflineQueueService);
  protected readonly truck = inject(TruckStore);
  protected readonly route = inject(RouteStore);
  protected readonly errors = inject(ErrorReportingService);
  private readonly auth = inject(AuthService);
  private readonly onboarding = inject(OnboardingService);
  private readonly alerts = inject(AlertController);
  private readonly toast = inject(ToastController);
  private readonly router = inject(Router);

  protected readonly isAndroid = signal(Capacitor.getPlatform() === 'android');
  protected readonly platform = Capacitor.getPlatform();
  protected readonly deviceId = signal<string | null>(null);
  protected readonly version = '0.1.0';
  protected readonly buildNumber = '10';

  /** Local mirror of the GPS interval signal — ion-range needs ngModel binding. */
  protected intervalMs = this.config.gpsPingIntervalMs;

  protected readonly intervalSec = computed(() => Math.round(this.intervalMs / 1000));

  async ngOnInit(): Promise<void> {
    try {
      const id = await Device.getId();
      this.deviceId.set(id.identifier ?? null);
    } catch {
      this.deviceId.set(null);
    }
    // Refresh queue count when the page opens.
    await this.queue.refreshCount();
  }

  protected onThemeChange(event: CustomEvent): void {
    const next = event.detail.value as ThemePreference;
    void this.theme.setPreference(next);
  }

  protected async onIntervalChange(): Promise<void> {
    await this.config.setGpsPingIntervalMs(this.intervalMs);
    const t = await this.toast.create({
      message: `GPS ping interval set to ${this.intervalSec()}s. Takes effect on next ping.`,
      duration: 2200, position: 'top', color: 'success',
      buttons: [{ icon: 'close', role: 'cancel' }],
    });
    await t.present();
  }

  protected async resetInterval(): Promise<void> {
    await this.config.resetGpsPingIntervalMs();
    this.intervalMs = this.config.gpsPingIntervalMs;
  }

  protected async reregister(): Promise<void> {
    await this.push.register();
    const t = await this.toast.create({
      message: this.push.registered()
        ? 'Push notifications re-registered.'
        : 'Could not register. Check Notifications permission in system settings.',
      duration: 2500, position: 'top',
      color: this.push.registered() ? 'success' : 'warning',
      buttons: [{ icon: 'close', role: 'cancel' }],
    });
    await t.present();
  }

  protected async openBatterySettings(): Promise<void> {
    const opened = await this.onboarding.openBatterySettings();
    if (!opened) {
      const t = await this.toast.create({
        message: "Couldn't open settings. Search 'battery optimisation' in your phone's Settings.",
        duration: 3500, position: 'top', color: 'warning',
        buttons: [{ icon: 'close', role: 'cancel' }],
      });
      await t.present();
    }
  }

  protected async reopenOnboarding(): Promise<void> {
    await this.onboarding.reset();
    await this.router.navigateByUrl('/onboarding');
  }

  protected goToQueue(): void {
    void this.router.navigateByUrl('/queue');
  }

  protected async copyDiagnostics(): Promise<void> {
    const lines = [
      `CurTIS v${this.version} (build ${this.buildNumber})`,
      `Env:       ${this.config.env}`,
      `Platform:  ${this.platform}`,
      `Device ID: ${this.deviceId() ?? '—'}`,
      `User ID:   ${this.session.userId() ?? '—'}`,
      `GPS ping:  ${this.intervalSec()}s`,
      `Theme:     ${this.theme.preference()} (effective: ${this.theme.scheme()})`,
      `Push:      perm=${this.push.permission()} registered=${this.push.registered()}`,
      `Queue:     ${this.queue.pendingCount()} pending, ${this.queue.deadLetterCount()} failed`,
      `Sentry:    ${this.errors.enabled() ? 'active' : 'no DSN'}`,
    ].join('\n');

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(lines);
      }
    } catch {
      // ignore — toast still informs
    }
    const t = await this.toast.create({
      message: 'Diagnostics copied to clipboard.',
      duration: 2000, position: 'top', color: 'success',
      buttons: [{ icon: 'close', role: 'cancel' }],
    });
    await t.present();
  }

  protected async confirmLogout(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Sign out?',
      message: 'You will need to sign in again to continue.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Sign out',
          role: 'destructive',
          handler: async () => {
            await this.auth.logout();
            this.truck.clear();
            this.route.clear();
            await this.router.navigateByUrl('/login', { replaceUrl: true });
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  /** Truncate long identifiers / URLs for display. */
  protected short(value: string, max = 18): string {
    if (!value) return '—';
    if (value.length <= max) return value;
    return value.slice(0, max - 1) + '…';
  }
}
