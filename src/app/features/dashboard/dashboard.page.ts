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
import { ActionSheetController, AlertController, IonicModule, ToastController } from '@ionic/angular';
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
import { CurtisIconComponent } from '../../shared/components/icon';
import {
  CurtisHeaderComponent,
  CurtisHeaderActionComponent,
  CurtisHeaderStatusComponent,
} from '../../shared/components/header';
import type { Truck, Route } from '../../core/models';

interface Tile {
  label: string;
  icon: string;
  route: string;
  requiresDay: boolean;
  tone?: 'primary' | 'tertiary' | 'success' | 'danger';
}

const CACHE_KEY_TRUCK = 'phase3.truck';
const CACHE_KEY_ROUTE = 'phase3.route';

/**
 * Dashboard — Phase 9 premium redesign.
 *
 * Layout (top-down):
 *   1. Slim header — greeting + settings cog
 *   2. Hero card — day status, route name, truck plate; primary action
 *      button (Start Day / End Day) anchored bottom-right of the hero
 *   3. Stat strip — battery, connectivity, tracker status (3 mini cards)
 *   4. Tile grid — operations actions (2 cols × 5 rows), the third
 *      Tier (tertiary tone) being evacuation, the Tier with danger
 *      tone being incident reporting
 *   5. Floating SOS FAB at bottom-right (pre-shift visible too)
 *
 * Behavior preserved from Phase 8:
 *   - hydrate from cache, refresh from API
 *   - Start/End Day prompts with mileage + gas
 *   - back-button minimises while day active, logout confirm otherwise
 *   - SOS routes to incident page with sos=1 flag after confirm
 */
@Component({
  selector: 'curtis-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonicModule,
    RouterLink,
    OfflineBannerComponent,
    CurtisIconComponent,
    CurtisHeaderComponent,
    CurtisHeaderActionComponent,
    CurtisHeaderStatusComponent,
  ],
  styles: [
    `
      :host { display: block; }
      ion-content {
        --background: var(--curtis-bg);
        /* Reserve scroll headroom so the last tile row can scroll fully above
         * the SOS FAB (24px from bottom + 56px tall = 80px occupied) plus
         * breathing room and the system safe-area inset. */
        --padding-bottom: calc(var(--curtis-space-24) + env(safe-area-inset-bottom, 0));
      }

      /* --- Hero card (day status) --- */
      .hero {
        position: relative;
        margin: 0 var(--curtis-space-4);
        padding: var(--curtis-space-5);
        border-radius: var(--curtis-radius-xl);
        background: var(--curtis-gradient-hero);
        color: var(--curtis-text-inverse);
        box-shadow: var(--curtis-shadow-md);
        overflow: hidden;
        animation: rise var(--curtis-duration-slow) var(--curtis-ease-out) both;
      }
      .hero::after {
        content: '';
        position: absolute; inset: 0;
        background:
          radial-gradient(80% 60% at 100% 0%, rgba(255, 255, 255, 0.12), transparent 60%),
          radial-gradient(60% 50% at 0% 100%, rgba(201, 162, 39, 0.16), transparent 70%);
        pointer-events: none;
      }
      .hero > * { position: relative; z-index: 1; }

      .hero__status {
        display: inline-flex;
        align-items: center;
        gap: var(--curtis-space-1_5);
        font-size: var(--curtis-text-xs);
        font-weight: var(--curtis-weight-semibold);
        letter-spacing: var(--curtis-tracking-wider);
        text-transform: uppercase;
        background: rgba(255, 255, 255, 0.14);
        padding: 5px var(--curtis-space-2_5);
        border-radius: var(--curtis-radius-pill);
        border: 1px solid rgba(255, 255, 255, 0.20);
      }
      .hero__status .dot {
        width: 6px; height: 6px; border-radius: var(--curtis-radius-pill);
        background: var(--gold-300);
      }
      .hero__status.active .dot { background: #34D399; box-shadow: 0 0 8px rgba(52, 211, 153, 0.7); }

      .hero__title {
        margin-top: var(--curtis-space-3);
        font-size: var(--curtis-text-2xl);
        font-weight: var(--curtis-weight-extrabold);
        letter-spacing: var(--curtis-tracking-tight);
        line-height: var(--curtis-leading-tight);
      }
      .hero__sub {
        margin-top: var(--curtis-space-1);
        font-size: var(--curtis-text-sm);
        color: rgba(255, 255, 255, 0.78);
      }

      .hero__details {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--curtis-space-4);
        margin-top: var(--curtis-space-5);
        padding-top: var(--curtis-space-4);
        border-top: 1px solid rgba(255, 255, 255, 0.16);
      }
      .hero__detail {
        display: flex; flex-direction: column;
        gap: var(--curtis-space-0_5);
      }
      .hero__detail-label {
        font-size: 10px;
        letter-spacing: var(--curtis-tracking-wider);
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.60);
        font-weight: var(--curtis-weight-semibold);
      }
      .hero__detail-value {
        font-size: var(--curtis-text-md);
        font-weight: var(--curtis-weight-bold);
        color: var(--curtis-text-inverse);
        font-variant-numeric: tabular-nums;
      }

      .hero__cta {
        margin-top: var(--curtis-space-5);
      }
      .hero__cta ion-button {
        --background: var(--gold-500);
        --background-hover: var(--gold-600);
        --color: #1A1A1A;
        --box-shadow: 0 8px 24px rgba(201, 162, 39, 0.35);
        font-weight: var(--curtis-weight-bold);
      }
      .hero__cta ion-button.end-day {
        --background: rgba(255, 255, 255, 0.14);
        --background-hover: rgba(255, 255, 255, 0.22);
        --color: var(--curtis-text-inverse);
        --box-shadow: none;
        border: 1px solid rgba(255, 255, 255, 0.20);
        border-radius: var(--curtis-radius-md);
      }

      /* --- Stat strip --- */
      .stat-strip {
        margin: var(--curtis-space-4);
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: var(--curtis-space-3);
        animation: rise var(--curtis-duration-slow) var(--curtis-ease-out) 60ms both;
      }
      .stat-card {
        background: var(--curtis-surface-1);
        border: 1px solid var(--curtis-border);
        border-radius: var(--curtis-radius-lg);
        padding: var(--curtis-space-3);
        display: flex; flex-direction: column;
        gap: var(--curtis-space-1);
        box-shadow: var(--curtis-shadow-xs);
      }
      .stat-card__head {
        display: flex; align-items: center; gap: var(--curtis-space-1_5);
        font-size: 10px;
        font-weight: var(--curtis-weight-semibold);
        letter-spacing: var(--curtis-tracking-wider);
        text-transform: uppercase;
        color: var(--curtis-text-subtle);
      }
      .stat-card__head curtis-icon { color: var(--curtis-text-muted); }
      .stat-card__value {
        font-size: var(--curtis-text-md);
        font-weight: var(--curtis-weight-bold);
        font-variant-numeric: tabular-nums;
        color: var(--curtis-text);
      }
      .stat-card__value.ok { color: var(--green-600); }
      .stat-card__value.warn { color: var(--amber-500); }
      .stat-card__value.bad { color: var(--red-500); }

      /* --- Tile grid --- */
      .grid-label {
        margin: var(--curtis-space-2) var(--curtis-space-4) var(--curtis-space-1);
        font-size: var(--curtis-text-xs);
        font-weight: var(--curtis-weight-bold);
        letter-spacing: var(--curtis-tracking-wider);
        text-transform: uppercase;
        color: var(--curtis-text-subtle);
      }
      .grid {
        margin: 0 var(--curtis-space-4) calc(var(--curtis-space-12) + env(safe-area-inset-bottom, 0));
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: var(--curtis-space-3);
      }
      @media (min-width: 600px) {
        .grid { grid-template-columns: repeat(3, 1fr); }
      }
      @media (min-width: 900px) {
        .grid { grid-template-columns: repeat(4, 1fr); }
      }

      .tile {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: var(--curtis-space-3);
        padding: var(--curtis-space-4);
        background: var(--curtis-surface-1);
        border: 1px solid var(--curtis-border);
        border-radius: var(--curtis-radius-lg);
        box-shadow: var(--curtis-shadow-xs);
        text-align: left;
        cursor: pointer;
        transition: transform var(--curtis-duration-fast) var(--curtis-ease-out),
                    box-shadow var(--curtis-duration-fast) var(--curtis-ease-out),
                    border-color var(--curtis-duration-fast) var(--curtis-ease-out);
        animation: rise var(--curtis-duration-slow) var(--curtis-ease-out) both;
      }
      .tile:hover:not(.disabled) {
        border-color: var(--curtis-border-strong);
        box-shadow: var(--curtis-shadow-md);
        transform: translateY(-2px);
      }
      .tile:active:not(.disabled) {
        transform: translateY(0);
        box-shadow: var(--curtis-shadow-xs);
      }
      .tile.disabled {
        cursor: not-allowed;
        opacity: 0.5;
      }
      .tile__icon {
        width: 44px; height: 44px;
        border-radius: var(--curtis-radius-md);
        display: grid; place-items: center;
        background: color-mix(in srgb, var(--ion-color-primary) 10%, transparent);
        color: var(--ion-color-primary);
      }
      .tile.tone-tertiary .tile__icon {
        background: color-mix(in srgb, var(--ion-color-tertiary) 18%, transparent);
        color: var(--gold-700);
      }
      .tile.tone-danger .tile__icon {
        background: color-mix(in srgb, var(--ion-color-danger) 12%, transparent);
        color: var(--red-500);
      }
      .tile__label {
        font-size: var(--curtis-text-base);
        font-weight: var(--curtis-weight-semibold);
        color: var(--curtis-text);
        line-height: var(--curtis-leading-snug);
      }
      .tile__hint {
        font-size: var(--curtis-text-xs);
        color: var(--curtis-text-subtle);
        margin-top: -0.25rem;
      }
      .tile__chev {
        position: absolute;
        top: var(--curtis-space-3);
        right: var(--curtis-space-3);
        color: var(--curtis-text-faint);
      }
      .tile.disabled .tile__chev { opacity: 0.4; }

      /* --- SOS FAB --- */
      .sos {
        position: fixed;
        right: var(--curtis-space-5);
        bottom: calc(var(--curtis-space-6) + env(safe-area-inset-bottom, 0));
        z-index: 100;
      }
      .sos__btn {
        width: 56px; height: 56px;
        border-radius: var(--curtis-radius-pill);
        background: var(--red-500);
        color: white;
        display: grid; place-items: center;
        box-shadow: 0 8px 24px rgba(239, 68, 68, 0.45),
                    0 0 0 4px rgba(239, 68, 68, 0.18);
        border: none;
        cursor: pointer;
        transition: transform var(--curtis-duration-fast) var(--curtis-ease-out);
        animation: sos-pulse 2.2s var(--curtis-ease-in-out) infinite;
      }
      .sos__btn:active { transform: scale(0.94); }

      @keyframes sos-pulse {
        0%, 100% { box-shadow: 0 8px 24px rgba(239, 68, 68, 0.45), 0 0 0 4px rgba(239, 68, 68, 0.18); }
        50%      { box-shadow: 0 8px 24px rgba(239, 68, 68, 0.55), 0 0 0 12px rgba(239, 68, 68, 0); }
      }
      @keyframes rise {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      /* Stagger tile entrance */
      .tile:nth-child(1) { animation-delay: 80ms; }
      .tile:nth-child(2) { animation-delay: 120ms; }
      .tile:nth-child(3) { animation-delay: 160ms; }
      .tile:nth-child(4) { animation-delay: 200ms; }
      .tile:nth-child(5) { animation-delay: 240ms; }
      .tile:nth-child(6) { animation-delay: 280ms; }
      .tile:nth-child(7) { animation-delay: 320ms; }
      .tile:nth-child(8) { animation-delay: 360ms; }
      .tile:nth-child(9) { animation-delay: 400ms; }
      .tile:nth-child(10) { animation-delay: 440ms; }
    `,
  ],
  template: `
    <curtis-header
      [title]="greeting()"
      [showBack]="false"
    >
      <curtis-header-status
        slot="status"
        [variant]="day.dayActive() ? 'success' : 'neutral'"
        [label]="day.dayActive() ? 'On shift' : 'Ready'"
      />
      <curtis-header-action
        slot="end"
        icon="settings-outline"
        ariaLabel="Open settings"
        routerLink="/settings"
      />
    </curtis-header>

    <ion-content [fullscreen]="true">
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <!-- Connectivity / sync banner -->
      <curtis-offline-banner />

      <!-- HERO: day status + primary CTA -->
      <section class="hero">
        <div class="hero__status" [class.active]="day.dayActive()">
          <span class="dot"></span>
          {{ day.dayActive() ? 'On shift' : 'Ready to start' }}
        </div>

        <h1 class="hero__title">
          {{ routeStore.route()?.clientName || 'No route assigned' }}
        </h1>
        <div class="hero__sub">
          {{ day.dayActive() ? 'Tracking is live' : 'Tap Start day to begin' }}
        </div>

        <div class="hero__details">
          <div class="hero__detail">
            <span class="hero__detail-label">Truck</span>
            <span class="hero__detail-value">{{ truck.truck()?.plateNo || '—' }}</span>
          </div>
          <div class="hero__detail">
            <span class="hero__detail-label">Stops</span>
            <span class="hero__detail-value">{{ routeStore.stops().length || '—' }}</span>
          </div>
        </div>

        <div class="hero__cta">
          @if (!day.dayActive()) {
            <ion-button
              expand="block"
              size="default"
              [disabled]="dayActionWorking()"
              (click)="promptStartDay()"
            >
              @if (dayActionWorking()) {
                <ion-spinner slot="start" name="crescent" />
                Starting…
              } @else {
                <curtis-icon slot="start" name="play-outline" size="sm" />
                Start day
              }
            </ion-button>
          } @else {
            <ion-button
              class="end-day"
              expand="block"
              size="default"
              [disabled]="dayActionWorking()"
              (click)="promptEndDay()"
            >
              @if (dayActionWorking()) {
                <ion-spinner slot="start" name="crescent" />
                Ending…
              } @else {
                <curtis-icon slot="start" name="power-outline" size="sm" />
                End day
              }
            </ion-button>
          }
        </div>
      </section>

      <!-- STAT STRIP -->
      <section class="stat-strip">
        <div class="stat-card">
          <div class="stat-card__head">
            <curtis-icon name="battery-half-outline" size="xs" />
            Battery
          </div>
          <div
            class="stat-card__value"
            [class.warn]="(battery.level() ?? 100) < 30"
            [class.bad]="(battery.level() ?? 100) < 15"
          >
            {{ battery.level() != null ? (battery.level() + '%') : '—' }}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-card__head">
            <curtis-icon name="cloud-offline-outline" size="xs" />
            Network
          </div>
          <div
            class="stat-card__value"
            [class.ok]="connectivity.online()"
            [class.bad]="!connectivity.online()"
          >
            {{ connectivity.online() ? 'Online' : 'Offline' }}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-card__head">
            <curtis-icon name="navigate-circle-outline" size="xs" />
            Tracking
          </div>
          <div
            class="stat-card__value"
            [class.ok]="tracker.running()"
            [class.warn]="!tracker.running()"
          >
            {{ tracker.running() ? 'Live' : 'Idle' }}
          </div>
        </div>
      </section>

      <!-- TILES -->
      <div class="grid-label">Quick actions</div>
      <section class="grid">
        @for (t of tiles; track t.route) {
          @if (t.requiresDay && !day.dayActive()) {
            <div
              class="tile disabled"
              [class.tone-tertiary]="t.tone === 'tertiary'"
              [class.tone-danger]="t.tone === 'danger'"
            >
              <div class="tile__icon">
                <curtis-icon [name]="t.icon" size="md" />
              </div>
              <div class="tile__label">{{ t.label }}</div>
              <div class="tile__hint">Start day to unlock</div>
              <curtis-icon class="tile__chev" name="chevron-forward-outline" size="xs" />
            </div>
          } @else {
            <a
              class="tile"
              [class.tone-tertiary]="t.tone === 'tertiary'"
              [class.tone-danger]="t.tone === 'danger'"
              [routerLink]="[t.route]"
            >
              <div class="tile__icon">
                <curtis-icon [name]="t.icon" size="md" />
              </div>
              <div class="tile__label">{{ t.label }}</div>
              <curtis-icon class="tile__chev" name="chevron-forward-outline" size="xs" />
            </a>
          }
        }
      </section>

      <!-- SOS FAB — always visible, even pre-shift -->
      <div class="sos">
        <button class="sos__btn" (click)="onSos($event)" aria-label="Send SOS">
          <curtis-icon name="warning-outline" size="lg" />
        </button>
      </div>
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
  protected readonly connectivity = inject(ConnectivityService);
  private readonly auth = inject(AuthService);
  private readonly trucks = inject(TruckService);
  private readonly routes = inject(RouteService);
  private readonly dayService = inject(DayService);
  private readonly cache = inject(ReferenceCacheService);
  private readonly alerts = inject(AlertController);
  private readonly actionSheets = inject(ActionSheetController);
  private readonly toast = inject(ToastController);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly dayActionWorking = signal(false);
  private backListener?: PluginListenerHandle;

  /** Personalised greeting line. */
  protected readonly greeting = computed(() => {
    const u = this.session.user();
    const name = u?.email?.split('@')[0] || u?.id?.slice(0, 8) || 'Agent';
    const hour = new Date().getHours();
    if (hour < 12) return `Good morning, ${name}`;
    if (hour < 17) return `Good afternoon, ${name}`;
    return `Good evening, ${name}`;
  });

  protected readonly tiles: Tile[] = [
    { label: 'Route map',     icon: 'map-outline',            route: '/map',                 requiresDay: false },
    { label: "Today's stops", icon: 'list-outline',           route: '/daily',               requiresDay: false },
    { label: 'Delivery',      icon: 'swap-horizontal-outline', route: '/delivery',           requiresDay: false },
    { label: 'Route seals',   icon: 'qr-code-outline',        route: '/route-scan',          requiresDay: false },
    { label: 'Bank seals',    icon: 'barcode-outline',        route: '/bank-scan',           requiresDay: false },
    { label: 'Manual evac',   icon: 'document-text-outline',  route: '/manual-evacuation',   requiresDay: false, tone: 'tertiary' },
    { label: 'Retail evac',   icon: 'receipt-outline',        route: '/retail-evacuation',   requiresDay: false, tone: 'tertiary' },
    { label: 'Incident',      icon: 'alert-circle-outline',   route: '/incident',            requiresDay: false, tone: 'danger' },
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
      // Run truck and route fetches in parallel. They are independent
      // backend resources — one is not a prerequisite for the other.
      // Previously route was nested inside `if (truck)`, so any truck
      // failure (network blip, 401, empty body) silently prevented the
      // route call from firing.
      const [truck, route] = await Promise.all([
        firstValueFrom(this.trucks.getMyTruck()).catch(() => null),
        firstValueFrom(this.routes.getMyRoute()).catch(() => null),
      ]);

      if (truck) {
        this.truck.set(truck);
        await this.cache.set(CACHE_KEY_TRUCK, truck);
      }
      if (route) {
        this.routeStore.setRoute(route);
        await this.cache.set(CACHE_KEY_ROUTE, route);
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
    const truck = this.truck.truck();
    const route = this.routeStore.route();

    const alert = await this.alerts.create({
      header: 'Start day',
      message: 'Step 1 of 2 — Record opening mileage.',
      inputs: [
        { name: 'mileage', type: 'number', placeholder: 'Opening mileage', min: 0, attributes: { inputmode: 'numeric' } },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Next',
          handler: (data: { mileage?: string }) => {
            const mileage = (data.mileage ?? '').trim();
            if (!this.isPositiveNumber(mileage)) {
              void this.showToast('Mileage is required (positive number).', 'warning');
              return false;
            }
            void this.promptStartDayGas(mileage, {
              truckId: truck?.id != null ? String(truck.id) : null,
              routeId: route?.routeId != null ? String(route.routeId) : null,
            });
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  /** Step 2 of Start Day: pick gas level (Full / Medium / Low). */
  private async promptStartDayGas(
    mileage: string,
    assignment: { truckId: string | null; routeId: string | null },
  ): Promise<void> {
    const sheet = await this.actionSheets.create({
      header: 'Step 2 of 2 — Gas level',
      buttons: [
        {
          text: 'Full',
          handler: () => void this.runStartDay({ mileage, gasLevel: 'Full', ...assignment }),
        },
        {
          text: 'Medium',
          handler: () => void this.runStartDay({ mileage, gasLevel: 'Medium', ...assignment }),
        },
        {
          text: 'Low',
          handler: () => void this.runStartDay({ mileage, gasLevel: 'Low', ...assignment }),
        },
        { text: 'Cancel', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  async promptEndDay(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'End day',
      message: 'Step 1 of 2 — Record closing mileage.',
      inputs: [
        { name: 'mileage', type: 'number', placeholder: 'Closing mileage', min: 0, attributes: { inputmode: 'numeric' } },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Next',
          role: 'destructive',
          handler: (data: { mileage?: string }) => {
            const mileage = (data.mileage ?? '').trim();
            if (!this.isPositiveNumber(mileage)) {
              void this.showToast('Mileage is required (positive number).', 'warning');
              return false;
            }
            void this.promptEndDayGas(mileage);
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  /** Step 2 of End Day: pick gas level (Full / Medium / Low). */
  private async promptEndDayGas(mileage: string): Promise<void> {
    const sheet = await this.actionSheets.create({
      header: 'Step 2 of 2 — Gas level',
      buttons: [
        { text: 'Full',   handler: () => void this.runEndDay({ mileage, gasLevel: 'Full' }) },
        { text: 'Medium', handler: () => void this.runEndDay({ mileage, gasLevel: 'Medium' }) },
        { text: 'Low',    handler: () => void this.runEndDay({ mileage, gasLevel: 'Low' }) },
        { text: 'Cancel', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  private async runStartDay(input: {
    mileage: string;
    gasLevel: string;
    truckId?: string | null;
    routeId?: string | null;
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
