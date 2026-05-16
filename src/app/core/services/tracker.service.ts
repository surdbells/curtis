import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Capacitor, registerPlugin } from '@capacitor/core';
import type {
  BackgroundGeolocationPlugin,
  Location,
} from '@capacitor-community/background-geolocation';

import { ApiService } from './api.service';
import { ActionBuilderService } from './action-builder.service';
import { ConfigService } from './config.service';
import { SessionStore } from '../stores/session.store';
import { DayStore } from '../stores/day.store';
import { ACTION, STATUS } from '../models';

/**
 * Capacitor-registered handle to the native BackgroundGeolocation plugin.
 * (The plugin package only ships type definitions; the runtime object is
 * obtained via registerPlugin — per its README.)
 */
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>(
  'BackgroundGeolocation',
);

/**
 * Background GPS tracker.
 *
 * Lifecycle:
 *   - start() is called by DayService.start() when the agent starts their day.
 *   - The plugin's addWatcher() begins emitting locations continuously, both
 *     in foreground and background (Android shows a persistent notification;
 *     iOS uses the `location` background mode declared in Info.plist).
 *   - Each emission is throttled in-service to at most one POST per
 *     `config.gpsPingIntervalMs` (30s by default). Faster emissions are
 *     dropped — we keep the most recent fix.
 *   - Per the Phase 6 decision, each POST is fired individually. If offline
 *     or the network errors, the offline interceptor (Phase 1) enqueues
 *     the request to SQLite for later replay.
 *   - stop() is called by DayService.end(). Watcher is removed; any in-
 *     flight POST is allowed to finish.
 *
 * Web platform: addWatcher is a no-op stub; start/stop succeed but no
 * pings fire. This keeps dev iteration unblocked.
 */
@Injectable({ providedIn: 'root' })
export class TrackerService {
  private readonly api = inject(ApiService);
  private readonly builder = inject(ActionBuilderService);
  private readonly config = inject(ConfigService);
  private readonly session = inject(SessionStore);
  private readonly day = inject(DayStore);

  /** Reactive: true while the watcher is active. */
  readonly running = signal<boolean>(false);
  /** Reactive: the most recent location fix received. */
  readonly lastFix = signal<Location | null>(null);
  /** Reactive: total pings posted this session (for debug + UI). */
  readonly pingCount = signal<number>(0);
  /** Reactive: most recent error reported by the watcher (for debug). */
  readonly lastError = signal<string | null>(null);

  private watcherId: string | null = null;
  /** Timestamp (ms) of the most recent POST. Throttle reference. */
  private lastPostAt = 0;

  isRunning(): boolean {
    return this.running();
  }

  async start(): Promise<void> {
    if (this.running()) return;
    if (!Capacitor.isNativePlatform()) {
      // Web/dev: pretend to be running so the rest of the UI behaves correctly.
      this.running.set(true);
      return;
    }

    try {
      this.watcherId = await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage:
            'CurTIS is tracking your route. This is required for cash-in-transit safety.',
          backgroundTitle: 'CurTIS — Active shift',
          requestPermissions: true,
          stale: false,
          distanceFilter: 0,
        },
        (location, error) => {
          if (error) {
            // eslint-disable-next-line no-console
            console.warn('[TrackerService] watcher error', error);
            this.lastError.set(error.message ?? 'Unknown tracker error');
            return;
          }
          if (!location) return;
          this.lastFix.set(location);
          void this.maybePost(location);
        },
      );
      this.running.set(true);
      this.lastError.set(null);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[TrackerService] start failed', err);
      this.lastError.set((err as Error)?.message ?? 'Could not start tracker');
      throw err;
    }
  }

  async stop(): Promise<void> {
    if (!this.running()) return;
    if (this.watcherId) {
      try {
        await BackgroundGeolocation.removeWatcher({ id: this.watcherId });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[TrackerService] stop failed', err);
      }
      this.watcherId = null;
    }
    this.running.set(false);
    this.lastPostAt = 0;
  }

  /**
   * Open the OS settings page for the app. Useful when location permission
   * has been denied and the user needs to enable it manually.
   */
  async openSettings(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await BackgroundGeolocation.openSettings();
    } catch {
      // ignore
    }
  }

  /** Apply the throttle and, if eligible, POST the location. */
  private async maybePost(location: Location): Promise<void> {
    const now = Date.now();
    if (now - this.lastPostAt < this.config.gpsPingIntervalMs) {
      // Too soon since the last post — drop.
      return;
    }
    this.lastPostAt = now;
    await this.post(location);
  }

  private async post(location: Location): Promise<void> {
    try {
      const dto = await this.builder.build({
        action: ACTION.GPS_PING,
        status: STATUS.OK,
        latitude: String(location.latitude),
        longitude: String(location.longitude),
        truckid: this.day.truckId(),
        routeid: this.day.routeId(),
      });
      await firstValueFrom(this.api.post<unknown>('/PostDeviceLocation', dto));
      this.pingCount.update((c) => c + 1);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[TrackerService] POST failed', err);
      // The offline interceptor enqueues failed POSTs — nothing more to do.
    }
  }
}
