import { Injectable, computed, inject, signal } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { App, AppState } from '@capacitor/app';
import { Geolocation, PermissionStatus } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import type { Coords } from './location.service';
import { LocationService } from './location.service';

/**
 * Location gate.
 *
 * Owns the app-wide notion of "do we have a current GPS fix?" After the user
 * logs in, `activate()` requests permission, takes a first fix, then keeps
 * the cached coords fresh via a foreground refresh loop. Every subsequent
 * API call reads `getLatest()` through ActionBuilderService and gets a
 * lat/long stamp on the wire payload for free.
 *
 * Architecture
 * ============
 * - One source of truth (`_coords` signal) consumed by ActionBuilder.
 * - One-shot `getCurrent()` at activate, then refresh on a timer +
 *   AppState 'active' events. We don't run continuous tracking here —
 *   that's TrackerService's job during an active day.
 * - Failures are surfaced through alerts that point the user to the right
 *   action: re-grant permission OR turn on system location services.
 *
 * Two failure modes are distinguished:
 *   permission-denied  ->  user said no in the OS prompt
 *   services-off       ->  permission granted but GPS / Location Services
 *                          is OFF at the OS level (or no fix within timeout)
 *
 * Both surface the same modal: "Location is required to use CurTIS" with
 * "Try again" + "Open settings" actions. The user can't fully use the app
 * without coords — checkouts, evacuations, seal scans, day start, all
 * need lat/long on the wire.
 */
@Injectable({ providedIn: 'root' })
export class LocationGateService {
  private readonly location = inject(LocationService);
  private readonly alert = inject(AlertController);

  /** Latest successful fix, or null until we have one. */
  private readonly _coords = signal<Coords | null>(null);
  readonly currentCoords = this._coords.asReadonly();

  /** Last attempt outcome. Drives banners/alerts. */
  private readonly _state = signal<'idle' | 'active' | 'permission-denied' | 'services-off'>('idle');
  readonly state = this._state.asReadonly();

  readonly hasFix = computed(() => this._coords() !== null);

  private refreshTimer?: ReturnType<typeof setInterval>;
  private appStateUnsub?: { remove: () => Promise<void> } | null;

  /**
   * Refresh interval while app is foregrounded. 30s balances battery vs
   * staleness — for a CIT runner most stops are minutes apart and any
   * write call also triggers a fresh refresh via `refresh()`.
   */
  private static readonly REFRESH_INTERVAL_MS = 30_000;

  /**
   * Call once after successful login. Idempotent — safe to call again.
   *
   * Returns true if we now have a fix, false otherwise. The page-level
   * caller (login -> dashboard transition) can use this to decide whether
   * to show a banner or block navigation.
   */
  async activate(): Promise<boolean> {
    // Already running — just trigger a fresh refresh.
    if (this._state() === 'active') {
      await this.refresh();
      return this.hasFix();
    }

    const ok = await this.acquireFirstFix();
    if (ok) {
      this._state.set('active');
      this.startRefreshLoop();
      await this.bindAppStateLifecycle();
    }
    return ok;
  }

  /** Stop the refresh loop. Called on logout. */
  async deactivate(): Promise<void> {
    this.stopRefreshLoop();
    if (this.appStateUnsub) {
      try { await this.appStateUnsub.remove(); } catch { /* noop */ }
      this.appStateUnsub = null;
    }
    this._coords.set(null);
    this._state.set('idle');
  }

  /**
   * Best-effort synchronous-style read used by ActionBuilder. Returns null
   * if we don't have a fix yet (canonical builder leaves lat/long as "").
   */
  getLatest(): Coords | null {
    return this._coords();
  }

  /**
   * Force an immediate refresh. Critical write paths (check-out, etc.)
   * call this before posting to guarantee a fresh stamp.
   */
  async refresh(): Promise<Coords | null> {
    const fix = await this.location.tryGetCurrent();
    if (fix) {
      this._coords.set(fix);
      if (this._state() !== 'active') this._state.set('active');
    }
    return fix;
  }

  /**
   * Show a blocking alert that walks the user to either re-grant permission
   * or open the OS settings to enable Location. Resolves after the user
   * dismisses the alert.
   *
   * Process-page / Manual-evac pages call this before a critical write
   * if they detect we don't have a fix.
   */
  async promptForLocation(): Promise<void> {
    const reason = this._state();
    const message =
      reason === 'permission-denied'
        ? 'CurTIS needs location permission to record check-ins, check-outs and evacuations. Please grant location access to continue.'
        : 'CurTIS needs an active GPS fix. Please turn on Location Services on your device, then try again.';

    const a = await this.alert.create({
      header: 'Location required',
      message,
      backdropDismiss: false,
      buttons: [
        {
          text: 'Try again',
          handler: () => {
            void this.activate();
          },
        },
        {
          text: 'Open settings',
          handler: () => {
            void this.openOsLocationSettings();
          },
        },
      ],
    });
    await a.present();
    await a.onDidDismiss();
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  /** Request permission + take the first fix. */
  private async acquireFirstFix(): Promise<boolean> {
    // Web has no native Geolocation plugin — silently skip (the browser
    // will prompt on demand via the underlying Geolocation API).
    if (!Capacitor.isNativePlatform()) {
      const fix = await this.location.tryGetCurrent();
      if (fix) {
        this._coords.set(fix);
        return true;
      }
      this._state.set('services-off');
      return false;
    }

    let perm: PermissionStatus;
    try {
      perm = await Geolocation.checkPermissions();
    } catch {
      this._state.set('services-off');
      return false;
    }

    if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
      try {
        perm = await Geolocation.requestPermissions();
      } catch {
        this._state.set('permission-denied');
        return false;
      }
    }

    if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
      this._state.set('permission-denied');
      return false;
    }

    // Permission OK — try to get a fix. Failure here means Location
    // Services are off at the OS level, or no GPS satellites in view.
    const fix = await this.location.tryGetCurrent();
    if (!fix) {
      this._state.set('services-off');
      return false;
    }
    this._coords.set(fix);
    return true;
  }

  private startRefreshLoop(): void {
    this.stopRefreshLoop();
    this.refreshTimer = setInterval(() => {
      void this.refresh();
    }, LocationGateService.REFRESH_INTERVAL_MS);
  }

  private stopRefreshLoop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  /** Pause refresh when app backgrounded; resume + immediate fix when foregrounded. */
  private async bindAppStateLifecycle(): Promise<void> {
    if (!Capacitor.isNativePlatform() || this.appStateUnsub) return;
    this.appStateUnsub = await App.addListener('appStateChange', (s: AppState) => {
      if (s.isActive) {
        // Returned to foreground — fresh fix + restart loop.
        void this.refresh();
        this.startRefreshLoop();
      } else {
        this.stopRefreshLoop();
      }
    });
  }

  /**
   * Open OS-level location settings. Capacitor's Geolocation plugin doesn't
   * expose a direct "open settings" action, so we fall back to a re-request
   * which on Android shows a system dialog with a settings shortcut.
   */
  private async openOsLocationSettings(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      // Re-requesting on Android, when the system service is off, prompts
      // the OS-level location-settings dialog. On iOS, it deep-links to
      // the app's settings if permission was previously denied.
      await Geolocation.requestPermissions();
      await this.activate();
    } catch {
      // User cancelled — leave state alone, they can try again.
    }
  }
}
