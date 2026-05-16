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
import { Router, RouterLink } from '@angular/router';
import { AlertController, IonicModule, ToastController } from '@ionic/angular';
import { App } from '@capacitor/app';
import { Haptics, NotificationType, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { firstValueFrom } from 'rxjs';

import { SessionStore } from '../../core/stores/session.store';
import { DayStore } from '../../core/stores/day.store';
import { RouteStore } from '../../core/stores/route.store';
import { TruckStore } from '../../core/stores/truck.store';
import { AuthService } from '../../core/services/auth.service';
import { TruckService } from '../../core/services/truck.service';
import { RouteService } from '../../core/services/route.service';
import { DayService } from '../../core/services/day.service';
import { ReferenceCacheService } from '../../core/services/reference-cache.service';
import { ConnectivityService } from '../../core/services/connectivity.service';
import { BatteryService } from '../../core/services/battery.service';
import { TrackerService } from '../../core/services/tracker.service';
import { OfflineBannerComponent } from '../../shared/components/offline-banner/offline-banner.component';
import type { Truck, Route } from '../../core/models';

interface Tile {
  label: string;
  icon: string;
  route: string;
  requiresDay: boolean;
  /** Group for visual styling. */
  tone?: 'primary' | 'tertiary' | 'success' | 'danger';
}

const CACHE_KEY_TRUCK = 'phase3.truck';
const CACHE_KEY_ROUTE = 'phase3.route';

@Component({
  selector: 'curtis-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule, RouterLink, OfflineBannerComponent],
  styles: [
    `
      :host { display: block; }
      ion-content { --background: var(--curtis-bg); }

      /* Day banner */
      .banner {
        margin: 0.75rem 0.75rem 0;
        padding: 1rem 1.1rem;
        border-radius: var(--curtis-radius-lg);
        background: var(--curtis-gradient-primary);
        color: var(--curtis-text-inverse);
        box-shadow: var(--curtis-shadow-md);
        position: relative;
        overflow: hidden;
      }
      .banner::after {
        content: '';
        position: absolute; inset: 0;
        background: radial-gradient(120% 80% at 90% 0%, rgba(255,255,255,0.16), transparent 60%);
        pointer-events: none;
      }
      .banner-row {
        display: flex; align-items: center; justify-content: space-between;
        gap: 0.75rem; position: relative; z-index: 1;
      }
      .banner-status { display: flex; flex-direction: column; gap: 0.1rem; }
      .banner-label {
        font-size: 0.68rem; font-weight: 700; letter-spacing: 0.12em;
        text-transform: uppercase; opacity: 0.78;
      }
      .banner-title { font-size: 1.15rem; font-weight: 700; }
      .banner-meta { font-size: 0.78rem; opacity: 0.85; }
      .banner ion-button { --border-radius: var(--curtis-radius-pill); font-weight: 600; }

      .pulse {
        display: inline-flex; align-items: center; gap: 0.4rem;
        font-size: 0.72rem; opacity: 0.9;
      }
      .pulse-dot {
        width: 8px; height: 8px; border-radius: 50%;
        background: var(--ion-color-tertiary);
        box-shadow: 0 0 0 0 currentColor;
        animation: dot 1.8s ease-out infinite;
      }
      .battery-warn {
        display: inline-flex; align-items: center; gap: 0.3rem;
        font-size: 0.7rem; font-weight: 600;
        margin-top: 0.3rem;
        padding: 0.15rem 0.55rem;
        border-radius: 999px;
        background: rgba(251, 191, 36, 0.2);
        color: #FBBF24;
        align-self: flex-start;
      }
      .battery-warn.critical {
        background: rgba(248, 113, 113, 0.22);
        color: #F87171;
      }
      .battery-warn ion-icon { font-size: 0.85rem; }
      @keyframes dot {
        0%   { box-shadow: 0 0 0 0 rgba(229, 192, 74, 0.6); }
        100% { box-shadow: 0 0 0 9px rgba(229, 192, 74, 0); }
      }

      /* Summary card */
      .summary {
        margin: 0.75rem;
        padding: 0.5rem 0;
        background: var(--curtis-surface-1);
        border: 1px solid var(--curtis-border);
        border-radius: var(--curtis-radius-md);
        box-shadow: var(--curtis-shadow-sm);
      }
      .summary .row {
        display: flex; justify-content: space-between; align-items: center;
        padding: 0.65rem 1rem;
        border-bottom: 1px solid var(--curtis-border);
      }
      .summary .row:last-child { border-bottom: none; }
      .summary .label {
        color: var(--curtis-text-subtle);
        font-size: 0.78rem;
      }
      .summary .value {
        font-weight: 600;
        color: var(--curtis-text);
      }

      /* Tile grid */
      .grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.65rem;
        padding: 0.5rem 0.75rem 1.25rem;
      }
      .tile {
        display: flex; flex-direction: column;
        align-items: flex-start; justify-content: space-between;
        gap: 0.7rem;
        padding: 1rem 1rem 0.9rem;
        min-height: 118px;
        border-radius: var(--curtis-radius-lg);
        background: var(--curtis-surface-1);
        border: 1px solid var(--curtis-border);
        box-shadow: var(--curtis-shadow-sm);
        color: var(--curtis-text);
        text-decoration: none;
        transition: transform 120ms ease-out, box-shadow 120ms ease-out;
        position: relative;
        overflow: hidden;
      }
      .tile:active { transform: scale(0.98); box-shadow: var(--curtis-shadow-sm); }
      .tile.disabled {
        opacity: 0.55;
        pointer-events: none;
      }

      .tile .icon-wrap {
        width: 38px; height: 38px;
        border-radius: 10px;
        display: grid; place-items: center;
        background: color-mix(in srgb, var(--ion-color-primary) 12%, transparent);
      }
      .tile.tone-tertiary .icon-wrap {
        background: color-mix(in srgb, var(--ion-color-tertiary) 18%, transparent);
      }
      .tile.tone-danger .icon-wrap {
        background: color-mix(in srgb, var(--ion-color-danger) 14%, transparent);
      }
      .tile .icon-wrap ion-icon {
        font-size: 1.25rem;
        color: var(--ion-color-primary);
      }
      .tile.tone-tertiary .icon-wrap ion-icon { color: var(--ion-color-tertiary); }
      .tile.tone-danger .icon-wrap ion-icon  { color: var(--ion-color-danger); }

      .tile .label { font-weight: 600; line-height: 1.25; }
      .tile .meta {
        font-size: 0.7rem;
        color: var(--curtis-text-subtle);
      }
      .tile.disabled .meta {
        color: var(--ion-color-warning-shade);
      }

      /* Warning card */
      .warning {
        margin: 0.75rem;
        padding: 0.85rem 1rem;
        border-radius: var(--curtis-radius-md);
        background: color-mix(in srgb, var(--ion-color-warning) 12%, var(--curtis-surface-1));
        border: 1px solid color-mix(in srgb, var(--ion-color-warning) 40%, transparent);
        color: var(--curtis-text);
        font-size: 0.85rem;
        display: flex; align-items: center; gap: 0.55rem;
      }
      .warning ion-icon {
        color: var(--ion-color-warning);
        font-size: 1.1rem;
        flex-shrink: 0;
      }

      .skeleton-stage {
        padding: 2rem 1rem; text-align: center;
        color: var(--curtis-text-subtle);
      }

      /* SOS — floating action button, bottom-right, always visible */
      .sos-fab {
        position: fixed;
        right: 1rem;
        bottom: 1rem;
        width: 64px; height: 64px;
        border-radius: 50%;
        background: var(--ion-color-danger);
        color: var(--ion-color-danger-contrast);
        display: grid; place-items: center;
        text-decoration: none;
        font-weight: 800; font-size: 0.85rem;
        letter-spacing: 0.05em;
        box-shadow:
          0 8px 24px rgba(220, 38, 38, 0.45),
          0 0 0 0 rgba(220, 38, 38, 0.4);
        z-index: 20;
        animation: sos-pulse 2.2s ease-out infinite;
        transition: transform 120ms ease-out;
      }
      .sos-fab:active { transform: scale(0.94); }
      .sos-fab ion-icon { font-size: 1.6rem; }
      @keyframes sos-pulse {
        0%   { box-shadow: 0 8px 24px rgba(220, 38, 38, 0.45), 0 0 0 0   rgba(220, 38, 38, 0.45); }
        70%  { box-shadow: 0 8px 24px rgba(220, 38, 38, 0.45), 0 0 0 14px rgba(220, 38, 38, 0);    }
        100% { box-shadow: 0 8px 24px rgba(220, 38, 38, 0.45), 0 0 0 0   rgba(220, 38, 38, 0);    }
      }
    `,
  ],
  template: `
    <ion-header translucent>
      <ion-toolbar>
        <ion-title>Dashboard</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="confirmLogout()">
            <ion-icon slot="icon-only" name="log-out-outline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <curtis-offline-banner />

      <!-- Day banner -->
      <div class="banner">
        <div class="banner-row">
          <div class="banner-status">
            <span class="banner-label">
              {{ day.dayActive() ? 'Active shift' : 'Awaiting start' }}
            </span>
            <span class="banner-title">
              {{ day.dayActive() ? 'Day in progress' : 'Day not started' }}
            </span>
            @if (session.user(); as u) {
              <span class="banner-meta">{{ u.email }}</span>
            }
            @if (day.dayActive()) {
              <span class="pulse">
                <span class="pulse-dot"></span>
                Tracking · {{ tracker.pingCount() }} pings
              </span>
            }
            @if (battery.isLow() || battery.isCritical()) {
              <span class="battery-warn" [class.critical]="battery.isCritical()">
                <ion-icon name="battery-half-outline" />
                @if (battery.isCritical()) {
                  Battery critical{{ battery.level() !== null ? ' · ' + battery.level() + '%' : '' }}
                } @else {
                  Low battery{{ battery.level() !== null ? ' · ' + battery.level() + '%' : '' }}
                }
              </span>
            }
          </div>
          <ion-button
            [color]="day.dayActive() ? 'danger' : 'tertiary'"
            size="default"
            [disabled]="dayActionWorking() || (!day.dayActive() && !canStartDay())"
            (click)="day.dayActive() ? promptEndDay() : promptStartDay()"
          >
            @if (dayActionWorking()) {
              <ion-spinner slot="start" name="crescent" />
            } @else {
              <ion-icon
                slot="start"
                [name]="day.dayActive() ? 'stop-circle-outline' : 'play-circle-outline'"
              />
            }
            {{ day.dayActive() ? 'End day' : 'Start day' }}
          </ion-button>
        </div>
      </div>

      @if (!loading() && !truck.truck()) {
        <div class="warning">
          <ion-icon name="warning-outline" />
          No truck assigned. Contact operations to continue.
        </div>
      }

      @if (loading() && !truck.truck()) {
        <div class="skeleton-stage">
          <ion-spinner name="crescent" />
          <div style="margin-top: 0.4rem;">Loading assignment…</div>
        </div>
      }

      @if (truck.truck(); as t) {
        <div class="summary">
          <div class="row">
            <span class="label">Truck</span>
            <span class="value">{{ t.plate || t.id || '—' }}</span>
          </div>
          @if (t.model) {
            <div class="row">
              <span class="label">Model</span>
              <span class="value">{{ t.model }}</span>
            </div>
          }
          @if (t.mileage !== undefined && t.mileage !== null) {
            <div class="row">
              <span class="label">Last mileage</span>
              <span class="value">{{ t.mileage }}</span>
            </div>
          }
          @if (routeStore.route(); as r) {
            <div class="row">
              <span class="label">Route</span>
              <span class="value">{{ r.name || r.id || '—' }}</span>
            </div>
            <div class="row">
              <span class="label">Stops</span>
              <span class="value">{{ routeStore.stops().length }}</span>
            </div>
          }
        </div>
      }

      <div class="grid">
        @for (t of tiles; track t.route) {
          @if (t.requiresDay && !day.dayActive()) {
            <div class="tile disabled" [class.tone-tertiary]="t.tone === 'tertiary'" [class.tone-danger]="t.tone === 'danger'">
              <div class="icon-wrap"><ion-icon [name]="t.icon" /></div>
              <div>
                <div class="label">{{ t.label }}</div>
                <div class="meta">Start day first</div>
              </div>
            </div>
          } @else {
            <a class="tile" [routerLink]="t.route" [class.tone-tertiary]="t.tone === 'tertiary'" [class.tone-danger]="t.tone === 'danger'">
              <div class="icon-wrap"><ion-icon [name]="t.icon" /></div>
              <div>
                <div class="label">{{ t.label }}</div>
                <div class="meta">Tap to open</div>
              </div>
            </a>
          }
        }
      </div>

      <!-- SOS — always visible, floats above tile grid. Tapping prompts a
           confirmation, then routes to /incident?sos=1 which pre-fills the
           form with high-urgency defaults. The photo capture step on the
           Incident page acts as a deliberate confirm-by-action gate so a
           pocket-tap can't actually submit a Robbery alert. -->
      <a class="sos-fab" (click)="onSos($event)">
        <ion-icon name="warning-outline" />
      </a>
    </ion-content>
  `,
})
export class DashboardPage implements OnInit, OnDestroy {
  protected readonly session = inject(SessionStore);
  protected readonly day = inject(DayStore);
  protected readonly truck = inject(TruckStore);
  protected readonly routeStore = inject(RouteStore);
  protected readonly battery = inject(BatteryService);
  protected readonly tracker = inject(TrackerService);
  private readonly auth = inject(AuthService);
  private readonly trucks = inject(TruckService);
  private readonly routes = inject(RouteService);
  private readonly dayService = inject(DayService);
  private readonly cache = inject(ReferenceCacheService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly alerts = inject(AlertController);
  private readonly toast = inject(ToastController);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly dayActionWorking = signal(false);
  private backListener?: PluginListenerHandle;

  protected readonly canStartDay = computed(
    () => !!this.truck.truck() && !!this.routeStore.route(),
  );

  protected readonly tiles: Tile[] = [
    { label: 'Route map', icon: 'map-outline', route: '/map', requiresDay: false },
    { label: 'Today’s stops', icon: 'list-outline', route: '/daily', requiresDay: true },
    { label: 'Delivery', icon: 'swap-horizontal-outline', route: '/delivery', requiresDay: true },
    { label: 'Process', icon: 'cog-outline', route: '/process', requiresDay: true },
    { label: 'Signature', icon: 'create-outline', route: '/signature', requiresDay: true },
    { label: 'Route seals', icon: 'qr-code-outline', route: '/route-scan', requiresDay: true },
    { label: 'Bank seals', icon: 'barcode-outline', route: '/bank-scan', requiresDay: true },
    { label: 'Manual evac', icon: 'document-text-outline', route: '/manual-evacuation', requiresDay: true, tone: 'tertiary' },
    { label: 'Retail evac', icon: 'receipt-outline', route: '/retail-evacuation', requiresDay: true, tone: 'tertiary' },
    { label: 'Incident', icon: 'alert-circle-outline', route: '/incident', requiresDay: true, tone: 'danger' },
  ];

  async ngOnInit(): Promise<void> {
    await this.hydrateFromCache();
    await this.loadAssignment();
    await this.wireBackButton();
  }

  async ngOnDestroy(): Promise<void> {
    await this.backListener?.remove();
    this.backListener = undefined;
  }

  async onRefresh(event: CustomEvent): Promise<void> {
    await this.loadAssignment();
    (event.target as HTMLIonRefresherElement).complete();
  }

  private async hydrateFromCache(): Promise<void> {
    const [cachedTruck, cachedRoute] = await Promise.all([
      this.cache.get<Truck>(CACHE_KEY_TRUCK),
      this.cache.get<Route>(CACHE_KEY_ROUTE),
    ]);
    if (cachedTruck) this.truck.set(cachedTruck);
    if (cachedRoute) this.routeStore.setRoute(cachedRoute);
  }

  private async loadAssignment(): Promise<void> {
    if (!this.connectivity.online()) return;
    this.loading.set(true);
    try {
      const truck = await firstValueFrom(this.trucks.getMyTruck()).catch(() => null);
      if (truck) {
        this.truck.set(truck);
        await this.cache.set(CACHE_KEY_TRUCK, truck);
        const route = await firstValueFrom(this.routes.getMyRoute()).catch(() => null);
        if (route) {
          this.routeStore.setRoute(route);
          await this.cache.set(CACHE_KEY_ROUTE, route);
        }
      }
    } finally {
      this.loading.set(false);
    }
  }

  private async wireBackButton(): Promise<void> {
    if (this.backListener) return;
    this.backListener = await App.addListener('backButton', () => {
      if (this.day.dayActive()) {
        void App.minimizeApp().catch(() => undefined);
        return;
      }
      void this.confirmLogout();
    });
  }

  /**
   * SOS button handler. Haptics warning, then confirms before navigating
   * to the Incident page in SOS mode. The photo capture step on that page
   * is the real submission gate — a pocket-tap of this FAB cannot fire
   * an actual alert to dispatch.
   */
  async onSos(event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    await this.haptic('warning');

    const alert = await this.alerts.create({
      header: 'Send SOS?',
      message:
        'This will open a high-priority incident report. You will need to capture a photo before it submits.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Open SOS report',
          role: 'destructive',
          handler: () => {
            void this.router.navigateByUrl('/incident?sos=1');
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  async promptStartDay(): Promise<void> {
    if (!this.canStartDay()) {
      await this.showToast('Truck and route must load before starting the day.', 'warning');
      return;
    }
    const truck = this.truck.truck();
    const route = this.routeStore.route();
    if (!truck?.id || !route?.id) {
      await this.showToast('Incomplete assignment data. Pull to refresh.', 'warning');
      return;
    }

    const alert = await this.alerts.create({
      header: 'Start day',
      message: 'Record opening mileage and gas level to begin the route.',
      inputs: [
        { name: 'mileage',  type: 'number', placeholder: 'Opening mileage', min: 0, attributes: { inputmode: 'numeric' } },
        { name: 'gasLevel', type: 'number', placeholder: 'Gas level (%)',   min: 0, max: 100, attributes: { inputmode: 'numeric' } },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Start',
          handler: (data: { mileage?: string; gasLevel?: string }) => {
            const mileage = (data.mileage ?? '').trim();
            const gasLevel = (data.gasLevel ?? '').trim();
            if (!this.isPositiveNumber(mileage) || !this.isPercentNumber(gasLevel)) {
              void this.showToast('Mileage and gas level are both required (gas 0–100).', 'warning');
              return false;
            }
            void this.runStartDay({ mileage, gasLevel, truckId: String(truck.id), routeId: String(route.id) });
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  async promptEndDay(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'End day',
      message: 'Record closing mileage and gas level to end the route.',
      inputs: [
        { name: 'mileage',  type: 'number', placeholder: 'Closing mileage', min: 0, attributes: { inputmode: 'numeric' } },
        { name: 'gasLevel', type: 'number', placeholder: 'Gas level (%)',   min: 0, max: 100, attributes: { inputmode: 'numeric' } },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'End day',
          role: 'destructive',
          handler: (data: { mileage?: string; gasLevel?: string }) => {
            const mileage = (data.mileage ?? '').trim();
            const gasLevel = (data.gasLevel ?? '').trim();
            if (!this.isPositiveNumber(mileage) || !this.isPercentNumber(gasLevel)) {
              void this.showToast('Mileage and gas level are both required (gas 0–100).', 'warning');
              return false;
            }
            void this.runEndDay({ mileage, gasLevel });
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  private async runStartDay(input: {
    mileage: string; gasLevel: string; truckId: string; routeId: string;
  }): Promise<void> {
    this.dayActionWorking.set(true);
    try {
      await this.dayService.start(input);
      await this.haptic('success');
      await this.showToast('Day started. Drive safe.', 'success');
    } catch (err) {
      await this.haptic('error');
      await this.showToast(this.describeError(err, 'Could not start day.'), 'danger');
    } finally {
      this.dayActionWorking.set(false);
    }
  }

  private async runEndDay(input: { mileage: string; gasLevel: string }): Promise<void> {
    this.dayActionWorking.set(true);
    try {
      await this.dayService.end(input);
      await this.haptic('success');
      await this.showToast('Day ended.', 'success');
    } catch (err) {
      await this.haptic('error');
      await this.showToast(this.describeError(err, 'Could not end day.'), 'danger');
    } finally {
      this.dayActionWorking.set(false);
    }
  }

  async confirmLogout(): Promise<void> {
    const active = this.day.dayActive();
    const alert = await this.alerts.create({
      header: active ? 'End session?' : 'Sign out?',
      message: active
        ? 'Your day is still active. Sign out will stop location tracking. End the day first if possible.'
        : 'You will need to sign in again to continue.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Sign out',
          role: 'destructive',
          handler: async () => {
            await this.auth.logout();
            this.truck.clear();
            this.routeStore.clear();
            await this.router.navigateByUrl('/login', { replaceUrl: true });
          },
        },
      ],
    });
    await alert.present();
  }

  private isPositiveNumber(v: string): boolean {
    if (!v) return false;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0;
  }

  private isPercentNumber(v: string): boolean {
    if (!v) return false;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= 100;
  }

  private describeError(err: unknown, fallback: string): string {
    if (err && typeof err === 'object') {
      const e = err as { message?: string };
      if (typeof e.message === 'string' && e.message.trim()) return e.message;
    }
    return fallback;
  }

  private async haptic(kind: 'success' | 'error' | 'tap' | 'warning'): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      if (kind === 'success') await Haptics.notification({ type: NotificationType.Success });
      else if (kind === 'error') await Haptics.notification({ type: NotificationType.Error });
      else if (kind === 'warning') await Haptics.notification({ type: NotificationType.Warning });
      else await Haptics.impact({ style: ImpactStyle.Light });
    } catch { /* ignore */ }
  }

  private async showToast(message: string, color: 'danger' | 'warning' | 'success') {
    const t = await this.toast.create({
      message, duration: 2500, position: 'top', color,
      buttons: [{ icon: 'close', role: 'cancel' }],
    });
    await t.present();
  }
}
