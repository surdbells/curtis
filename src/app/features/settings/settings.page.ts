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
import { CurtisIconComponent } from '../../shared/components/icon';
import { CurtisHeaderComponent } from '../../shared/components/header';

/**
 * Settings — Phase 9 premium redesign.
 *
 * Sections (top-down):
 *   1. Profile — user identity, truck/route summary, sign-out
 *   2. Appearance — theme override segment with effective scheme below
 *   3. Location tracking — GPS interval slider with live readout
 *   4. Notifications — permission/registration status, re-register
 *   5. Background activity (Android) — battery exemption + re-show onboarding
 *   6. Diagnostics — version, env, device, queue, error reporting + copy
 *   7. Brand signature footer
 *
 * Each section uses the new .curtis-card-list pattern: a navy-tinted
 * label above a card containing kv-rows + actions.
 *
 * Behavior is preserved from Phase 8.
 */
@Component({
  selector: 'curtis-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule, FormsModule, CurtisIconComponent, CurtisHeaderComponent],
  styles: [
    `
      :host { display: block; }
      ion-content { --background: var(--curtis-bg); }

      .stage {
        padding: 0 var(--curtis-space-3) calc(var(--curtis-space-12) + env(safe-area-inset-bottom, 0));
      }

      .section-label {
        margin: var(--curtis-space-5) var(--curtis-space-2) var(--curtis-space-2);
        font-size: var(--curtis-text-xs);
        font-weight: var(--curtis-weight-bold);
        letter-spacing: var(--curtis-tracking-wider);
        text-transform: uppercase;
        color: var(--curtis-text-subtle);
      }

      .card {
        background: var(--curtis-surface-1);
        border: 1px solid var(--curtis-border);
        border-radius: var(--curtis-radius-lg);
        box-shadow: var(--curtis-shadow-xs);
        overflow: hidden;
      }

      .row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--curtis-space-3);
        padding: var(--curtis-space-3_5) var(--curtis-space-4);
        padding: 0.75rem 1rem;
        border-bottom: 1px solid var(--curtis-border);
        min-height: 52px;
      }
      .row:last-child { border-bottom: none; }
      .row__key {
        font-size: var(--curtis-text-sm);
        color: var(--curtis-text-muted);
        font-weight: var(--curtis-weight-medium);
      }
      .row__value {
        font-size: var(--curtis-text-sm);
        font-weight: var(--curtis-weight-semibold);
        color: var(--curtis-text);
        font-variant-numeric: tabular-nums;
        text-align: right;
        max-width: 60%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .row__value.mono {
        font-family: var(--curtis-font-mono);
        font-size: var(--curtis-text-xs);
      }
      .row__value.ok   { color: var(--green-600); }
      .row__value.warn { color: var(--amber-500); }
      .row__value.bad  { color: var(--red-500); }

      .seg-row { padding: var(--curtis-space-3) var(--curtis-space-3); }
      .seg-row ion-segment-button curtis-icon { margin-bottom: 2px; }

      .slider-row { padding: var(--curtis-space-4); }
      .slider-row__head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: var(--curtis-space-2);
      }
      .slider-row__head .label {
        font-size: var(--curtis-text-sm);
        color: var(--curtis-text-muted);
        font-weight: var(--curtis-weight-medium);
      }
      .slider-row__head .val {
        font-size: var(--curtis-text-lg);
        font-weight: var(--curtis-weight-bold);
        font-variant-numeric: tabular-nums;
        color: var(--curtis-text);
      }
      .slider-row__meta {
        display: flex;
        justify-content: space-between;
        font-size: var(--curtis-text-xs);
        color: var(--curtis-text-subtle);
        margin-top: var(--curtis-space-1);
      }

      .actions {
        padding: var(--curtis-space-2) var(--curtis-space-4) var(--curtis-space-3);
        display: flex;
        gap: var(--curtis-space-2);
        flex-wrap: wrap;
      }
      .actions ion-button {
        --border-radius: var(--curtis-radius-md);
        min-height: 36px;
        font-size: var(--curtis-text-sm);
        --padding-top: 0.45rem;
        --padding-bottom: 0.45rem;
      }

      /* Footer brand signature */
      .footer {
        margin-top: var(--curtis-space-12);
        text-align: center;
        color: var(--curtis-text-subtle);
      }
      .footer__brand {
        font-size: var(--curtis-text-base);
        font-weight: var(--curtis-weight-extrabold);
        letter-spacing: var(--curtis-tracking-widest);
        color: var(--curtis-text-muted);
      }
      .footer__sub {
        margin-top: var(--curtis-space-1);
        font-size: var(--curtis-text-xs);
      }
      .footer__version {
        margin-top: var(--curtis-space-2);
        font-size: var(--curtis-text-xs);
        font-variant-numeric: tabular-nums;
      }
    `,
  ],
  template: `
    <curtis-header title="Settings" backHref="/dashboard" />

    <ion-content [fullscreen]="true">
      <div class="stage">
        <!-- Profile -->
        <div class="section-label">Profile</div>
        <div class="card">
          @if (session.user(); as u) {
            <div class="row">
              <span class="row__key">Signed in as</span>
              <span class="row__value">{{ u.email || u.id }}</span>
            </div>
            <div class="row">
              <span class="row__key">User ID</span>
              <span class="row__value mono">{{ short(u.id) }}</span>
            </div>
          } @else {
            <div class="row">
              <span class="row__key">Status</span>
              <span class="row__value bad">Not signed in</span>
            </div>
          }
          @if (truck.truck(); as t) {
            <div class="row">
              <span class="row__key">Truck</span>
              <span class="row__value">{{ t.plateNo || t.id }}</span>
            </div>
          }
          @if (route.route(); as r) {
            <div class="row">
              <span class="row__key">Route</span>
              <span class="row__value">{{ r.clientName || r.routeId }}</span>
            </div>
          }
          <div class="actions">
            <ion-button color="danger" fill="outline" (click)="confirmLogout()">
              <curtis-icon slot="start" name="log-out-outline" size="sm" />
              Sign out
            </ion-button>
          </div>
        </div>

        <!-- Appearance -->
        <div class="section-label">Appearance</div>
        <div class="card">
          <div class="seg-row">
            <ion-segment [value]="theme.preference()" (ionChange)="onThemeChange($event)">
              <ion-segment-button value="system">
                <curtis-icon name="phone-portrait-outline" size="sm" />
                <ion-label>System</ion-label>
              </ion-segment-button>
              <ion-segment-button value="light">
                <curtis-icon name="sunny-outline" size="sm" />
                <ion-label>Light</ion-label>
              </ion-segment-button>
              <ion-segment-button value="dark">
                <curtis-icon name="moon-outline" size="sm" />
                <ion-label>Dark</ion-label>
              </ion-segment-button>
            </ion-segment>
          </div>
          <div class="row">
            <span class="row__key">Current scheme</span>
            <span class="row__value">{{ theme.scheme() }}</span>
          </div>
        </div>

        <!-- Location tracking -->
        <div class="section-label">Location tracking</div>
        <div class="card">
          <div class="slider-row">
            <div class="slider-row__head">
              <span class="label">GPS ping interval</span>
              <span class="val">{{ intervalSec() }} s</span>
            </div>
            <ion-range
              [min]="config.gpsIntervalMin"
              [max]="config.gpsIntervalMax"
              [step]="5000"
              snaps="true"
              [(ngModel)]="intervalMs"
              (ionChange)="onIntervalChange()"
            />
            <div class="slider-row__meta">
              <span>15s · high resolution</span>
              <span>5m · save battery</span>
            </div>
          </div>
          <div class="actions">
            <ion-button fill="clear" (click)="resetInterval()">
              <curtis-icon slot="start" name="refresh-outline" size="sm" />
              Reset to default
            </ion-button>
          </div>
        </div>

        <!-- Notifications -->
        <div class="section-label">Notifications</div>
        <div class="card">
          <div class="row">
            <span class="row__key">Permission</span>
            <span
              class="row__value"
              [class.ok]="push.permission() === 'granted'"
              [class.bad]="push.permission() === 'denied'"
              [class.warn]="push.permission() === 'unknown'"
            >
              {{ push.permission() }}
            </span>
          </div>
          <div class="row">
            <span class="row__key">Registered</span>
            <span class="row__value" [class.ok]="push.registered()" [class.bad]="!push.registered()">
              {{ push.registered() ? 'Yes' : 'No' }}
            </span>
          </div>
          @if (push.token(); as t) {
            <div class="row">
              <span class="row__key">Token</span>
              <span class="row__value mono">{{ short(t) }}</span>
            </div>
          }
          <div class="actions">
            <ion-button fill="outline" (click)="reregister()">
              <curtis-icon slot="start" name="cloud-upload-outline" size="sm" />
              Re-register
            </ion-button>
          </div>
        </div>

        <!-- Background activity (Android) -->
        @if (isAndroid()) {
          <div class="section-label">Background activity</div>
          <div class="card">
            <div class="row">
              <span class="row__key">Battery optimisation</span>
              <span class="row__value">Managed by Android</span>
            </div>
            <div class="actions">
              <ion-button fill="outline" (click)="openBatterySettings()">
                <curtis-icon slot="start" name="battery-charging-outline" size="sm" />
                Open battery settings
              </ion-button>
              <ion-button fill="clear" color="medium" (click)="reopenOnboarding()">
                <curtis-icon slot="start" name="information-circle-outline" size="sm" />
                Show onboarding
              </ion-button>
            </div>
          </div>
        }

        <!-- Diagnostics -->
        <div class="section-label">Diagnostics</div>
        <div class="card">
          <div class="row">
            <span class="row__key">Version</span>
            <span class="row__value mono">{{ version }}</span>
          </div>
          <div class="row">
            <span class="row__key">Build</span>
            <span class="row__value mono">{{ buildNumber }}</span>
          </div>
          <div class="row">
            <span class="row__key">Environment</span>
            <span class="row__value mono">{{ config.env }}</span>
          </div>
          <div class="row">
            <span class="row__key">API base</span>
            <span class="row__value mono">{{ short(config.apiBaseUrl, 32) }}</span>
          </div>
          <div class="row">
            <span class="row__key">Platform</span>
            <span class="row__value mono">{{ platform }}</span>
          </div>
          <div class="row">
            <span class="row__key">Device ID</span>
            <span class="row__value mono">{{ short(deviceId() ?? '—') }}</span>
          </div>
          <div class="row">
            <span class="row__key">Pending syncs</span>
            <span
              class="row__value"
              [class.ok]="queue.pendingCount() === 0 && queue.deadLetterCount() === 0"
              [class.warn]="queue.pendingCount() > 0 && queue.deadLetterCount() === 0"
              [class.bad]="queue.deadLetterCount() > 0"
            >
              {{ queue.pendingCount() }} pending · {{ queue.deadLetterCount() }} failed
            </span>
          </div>
          <div class="row">
            <span class="row__key">Error reporting</span>
            <span class="row__value" [class.ok]="errors.enabled()" [class.warn]="!errors.enabled()">
              {{ errors.enabled() ? 'Active' : 'No DSN configured' }}
            </span>
          </div>
          <div class="actions">
            <ion-button fill="outline" (click)="goToQueue()">
              <curtis-icon slot="start" name="list-outline" size="sm" />
              Sync queue
            </ion-button>
            <ion-button fill="clear" color="medium" (click)="copyDiagnostics()">
              <curtis-icon slot="start" name="copy-outline" size="sm" />
              Copy diagnostics
            </ion-button>
          </div>
        </div>

        <!-- Footer -->
        <div class="footer">
          <div class="footer__brand">CURTIS</div>
          <div class="footer__sub">Currency Tracking and Information System</div>
          <div class="footer__version">v{{ version }} · build {{ buildNumber }}</div>
        </div>
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

  protected intervalMs = this.config.gpsPingIntervalMs;
  protected readonly intervalSec = computed(() => Math.round(this.intervalMs / 1000));

  async ngOnInit(): Promise<void> {
    try {
      const id = await Device.getId();
      this.deviceId.set(id.identifier ?? null);
    } catch {
      this.deviceId.set(null);
    }
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
    } catch { /* ignore */ }
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

  protected short(value: string, max = 18): string {
    if (!value) return '—';
    if (value.length <= max) return value;
    return value.slice(0, max - 1) + '…';
  }
}
