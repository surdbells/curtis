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
import { OfflineBannerComponent } from '../../shared/components/offline-banner/offline-banner.component';
import type { Truck, Route } from '../../core/models';

interface Tile {
  label: string;
  icon: string;
  route: string;
  phase: number;
  requiresDay: boolean;
}

const CACHE_KEY_TRUCK = 'phase3.truck';
const CACHE_KEY_ROUTE = 'phase3.route';

/**
 * Dashboard — Phase 3.
 *
 * On init:
 *   1. Hydrate truck and route from SQLite cache (instant render).
 *   2. Fetch /GetTruckByUserId in the foreground.
 *      - No truck assigned  -> surface warning state, skip route fetch.
 *      - Truck assigned     -> fetch /GetRouteByUserId.
 *   3. On pull-to-refresh, repeat the fetch pair.
 *
 * Start Day / End Day are handled via DayService + ion-alert prompts that
 * collect mileage + gas level (both required).
 */
@Component({
  selector: 'curtis-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule, RouterLink, OfflineBannerComponent],
  styles: [
    `
      .day-banner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.9rem 1rem;
        background: var(--ion-color-primary);
        color: var(--ion-color-primary-contrast);
      }
      .day-banner .meta {
        font-size: 0.78rem;
        opacity: 0.88;
      }

      .summary {
        padding: 0.75rem 1rem 0;
        display: grid;
        gap: 0.5rem;
      }
      .summary .row {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.6rem 0.9rem;
        background: var(--ion-color-light);
        border-radius: 10px;
      }
      .summary .row .label {
        color: var(--ion-color-medium);
        font-size: 0.8rem;
      }
      .summary .row .value {
        font-weight: 600;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.75rem;
        padding: 0.75rem;
      }
      .tile {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 1.25rem 0.5rem;
        border-radius: 12px;
        background: var(--ion-color-light);
        text-align: center;
        color: var(--ion-color-dark);
        text-decoration: none;
        min-height: 110px;
      }
      .tile.disabled {
        opacity: 0.45;
        pointer-events: none;
      }
      .tile ion-icon {
        font-size: 2rem;
        color: var(--ion-color-primary);
      }
      .tile small {
        color: var(--ion-color-medium);
      }

      .warning {
        margin: 0.75rem 1rem;
        padding: 0.9rem 1rem;
        border-radius: 10px;
        background: var(--ion-color-warning);
        color: var(--ion-color-warning-contrast);
        font-size: 0.85rem;
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

      <div class="day-banner">
        <div>
          <strong>{{ day.dayActive() ? 'Day active' : 'Day not started' }}</strong>
          @if (session.user(); as u) {
            <div class="meta">{{ u.email }}</div>
          }
        </div>
        <ion-button
          [color]="day.dayActive() ? 'light' : 'tertiary'"
          [disabled]="dayActionWorking() || !canStartDay()"
          fill="solid"
          size="small"
          (click)="day.dayActive() ? promptEndDay() : promptStartDay()"
        >
          @if (dayActionWorking()) {
            <ion-spinner slot="start" name="crescent" />
          }
          {{ day.dayActive() ? 'End day' : 'Start day' }}
        </ion-button>
      </div>

      @if (!loading() && !truck.truck()) {
        <div class="warning">
          <ion-icon name="warning-outline" /> No truck assigned. Contact operations to continue.
        </div>
      }

      @if (loading() && !truck.truck()) {
        <div style="padding: 1rem; text-align: center; color: var(--ion-color-medium);">
          <ion-spinner name="crescent" />
          <div>Loading assignment…</div>
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
            <div class="tile disabled">
              <ion-icon [name]="t.icon" />
              <div>{{ t.label }}</div>
              <small>Start day first</small>
            </div>
          } @else {
            <a class="tile" [routerLink]="t.route">
              <ion-icon [name]="t.icon" />
              <div>{{ t.label }}</div>
              <small>Phase {{ t.phase }}</small>
            </a>
          }
        }
      </div>
    </ion-content>
  `,
})
export class DashboardPage implements OnInit, OnDestroy {
  protected readonly session = inject(SessionStore);
  protected readonly day = inject(DayStore);
  protected readonly truck = inject(TruckStore);
  protected readonly routeStore = inject(RouteStore);
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

  /** Can the agent start the day? Requires both truck and route available. */
  protected readonly canStartDay = computed(
    () => !!this.truck.truck() && !!this.routeStore.route(),
  );

  protected readonly tiles: Tile[] = [
    { label: 'Route map', icon: 'map-outline', route: '/map', phase: 3, requiresDay: false },
    { label: 'Today’s stops', icon: 'list-outline', route: '/daily', phase: 4, requiresDay: true },
    { label: 'Delivery', icon: 'swap-horizontal-outline', route: '/delivery', phase: 4, requiresDay: true },
    { label: 'Process', icon: 'cog-outline', route: '/process', phase: 4, requiresDay: true },
    { label: 'Signature', icon: 'create-outline', route: '/signature', phase: 4, requiresDay: true },
    { label: 'Route seals', icon: 'qr-code-outline', route: '/route-scan', phase: 5, requiresDay: true },
    { label: 'Bank seals', icon: 'barcode-outline', route: '/bank-scan', phase: 5, requiresDay: true },
    { label: 'Manual evacuation', icon: 'document-text-outline', route: '/manual-evacuation', phase: 5, requiresDay: true },
    { label: 'Retail evacuation', icon: 'receipt-outline', route: '/retail-evacuation', phase: 5, requiresDay: true },
    { label: 'Incident', icon: 'alert-circle-outline', route: '/incident', phase: 6, requiresDay: true },
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

  /**
   * Intercept the hardware back button on Dashboard. Android's default
   * behaviour is to exit the app, which on a CIT device mid-shift would
   * be disastrous — instead we prompt for logout confirmation or minimise
   * the app if the day is active.
   *
   * @capacitor/app's listener is a no-op on iOS, so this is effectively
   * Android-only.
   */
  private async wireBackButton(): Promise<void> {
    if (this.backListener) return;
    this.backListener = await App.addListener('backButton', () => {
      if (this.day.dayActive()) {
        // Mid-shift: minimise instead of exiting. The tracker stays alive.
        void App.minimizeApp().catch(() => undefined);
        return;
      }
      // Day not active: treat back as a logout gesture with confirmation.
      void this.confirmLogout();
    });
  }

  /** Pull-to-refresh handler. */
  async onRefresh(event: CustomEvent): Promise<void> {
    await this.loadAssignment();
    (event.target as HTMLIonRefresherElement).complete();
  }

  /**
   * Load cached truck + route first so the UI is never blank if SQLite
   * has a prior copy. Called synchronously on init before network fetch.
   */
  private async hydrateFromCache(): Promise<void> {
    const [cachedTruck, cachedRoute] = await Promise.all([
      this.cache.get<Truck>(CACHE_KEY_TRUCK),
      this.cache.get<Route>(CACHE_KEY_ROUTE),
    ]);
    if (cachedTruck) this.truck.set(cachedTruck);
    if (cachedRoute) this.routeStore.setRoute(cachedRoute);
  }

  /**
   * Fetch truck, then route. Skips the network round-trip when offline —
   * cache is already loaded.
   */
  private async loadAssignment(): Promise<void> {
    if (!this.connectivity.online()) return;

    this.loading.set(true);
    try {
      // 1. Truck first — per Phase 3 decision.
      const truck = await firstValueFrom(this.trucks.getMyTruck()).catch(() => null);
      if (truck) {
        this.truck.set(truck);
        await this.cache.set(CACHE_KEY_TRUCK, truck);

        // 2. Route only if truck resolved.
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

  /** Open an alert prompting for opening mileage + gas level. */
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
        {
          name: 'mileage',
          type: 'number',
          placeholder: 'Opening mileage',
          min: 0,
          attributes: { inputmode: 'numeric' },
        },
        {
          name: 'gasLevel',
          type: 'number',
          placeholder: 'Gas level (%)',
          min: 0,
          max: 100,
          attributes: { inputmode: 'numeric' },
        },
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
        {
          name: 'mileage',
          type: 'number',
          placeholder: 'Closing mileage',
          min: 0,
          attributes: { inputmode: 'numeric' },
        },
        {
          name: 'gasLevel',
          type: 'number',
          placeholder: 'Gas level (%)',
          min: 0,
          max: 100,
          attributes: { inputmode: 'numeric' },
        },
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
    mileage: string;
    gasLevel: string;
    truckId: string;
    routeId: string;
  }): Promise<void> {
    this.dayActionWorking.set(true);
    try {
      await this.dayService.start(input);
      await this.showToast('Day started. Drive safe.', 'success');
    } catch (err) {
      await this.showToast(this.describeError(err, 'Could not start day.'), 'danger');
    } finally {
      this.dayActionWorking.set(false);
    }
  }

  private async runEndDay(input: { mileage: string; gasLevel: string }): Promise<void> {
    this.dayActionWorking.set(true);
    try {
      await this.dayService.end(input);
      await this.showToast('Day ended.', 'success');
    } catch (err) {
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

  // --- validators & helpers ---

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
