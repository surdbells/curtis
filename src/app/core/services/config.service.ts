import { Injectable, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { environment } from '../../../environments/environment';

const GPS_INTERVAL_KEY = 'curtis.config.gpsPingIntervalMs';

const MIN_INTERVAL = 15_000;     // 15 seconds — practical lower bound
const MAX_INTERVAL = 5 * 60_000; // 5 minutes — practical upper bound

/**
 * Thin wrapper around the environment object plus a small set of
 * runtime-overridable values (currently just the GPS ping interval).
 *
 * Build-time fields (apiBaseUrl, appId, env, production, sentry*) are
 * exposed as readonly properties — they're baked into the bundle.
 *
 * Runtime fields (gpsPingIntervalMs) are exposed as reactive signals so
 * subscribers can react to changes. The Settings page is the canonical
 * mutator; everything else reads via the signal getter.
 */
@Injectable({ providedIn: 'root' })
export class ConfigService {
  // --- Build-time (immutable) ------------------------------------------------
  readonly apiBaseUrl = environment.apiBaseUrl;
  readonly appId = environment.appId;
  readonly env = environment.env;
  readonly production = environment.production;
  readonly tokenRefreshThresholdSec = environment.tokenRefreshThresholdSec;
  readonly offlineQueueMaxRetries = environment.offlineQueueMaxRetries;
  readonly mapTileUrl = environment.mapTileUrl;
  readonly mapAttribution = environment.mapAttribution;

  readonly sentryDsn = environment.sentryDsn;
  readonly sentryTracesSampleRate = environment.sentryTracesSampleRate;
  readonly sentryRelease = environment.sentryRelease;

  // --- Runtime-overridable ---------------------------------------------------

  /**
   * GPS ping interval in milliseconds. Default comes from env; overridable
   * via setGpsPingIntervalMs() and persisted to @capacitor/preferences.
   *
   * Read via `config.gpsPingIntervalMs` for compatibility with existing
   * call sites — the getter returns the current signal value.
   */
  private readonly _gpsPingIntervalMs = signal<number>(environment.gpsPingIntervalMs);
  readonly gpsPingIntervalMsSignal = this._gpsPingIntervalMs.asReadonly();

  /** Synchronous accessor for compatibility with non-reactive callers. */
  get gpsPingIntervalMs(): number {
    return this._gpsPingIntervalMs();
  }

  /** Practical bounds the Settings UI clamps to. */
  readonly gpsIntervalMin = MIN_INTERVAL;
  readonly gpsIntervalMax = MAX_INTERVAL;

  /**
   * Load any persisted overrides. Called once at app bootstrap from the
   * app initialiser before features that read config initialise.
   */
  async hydrate(): Promise<void> {
    try {
      const { value } = await Preferences.get({ key: GPS_INTERVAL_KEY });
      const parsed = value ? Number(value) : NaN;
      if (Number.isFinite(parsed) && parsed >= MIN_INTERVAL && parsed <= MAX_INTERVAL) {
        this._gpsPingIntervalMs.set(parsed);
      }
    } catch {
      // ignore — keep env default
    }
  }

  /**
   * Update the GPS ping interval. Clamps to the supported range and
   * persists the new value. TrackerService picks up the new value on
   * its next throttle check (no restart required).
   */
  async setGpsPingIntervalMs(ms: number): Promise<void> {
    const clamped = Math.min(MAX_INTERVAL, Math.max(MIN_INTERVAL, Math.round(ms)));
    this._gpsPingIntervalMs.set(clamped);
    try {
      await Preferences.set({ key: GPS_INTERVAL_KEY, value: String(clamped) });
    } catch {
      // ignore — value still applied in-memory
    }
  }

  /** Reset GPS interval to the env default. */
  async resetGpsPingIntervalMs(): Promise<void> {
    this._gpsPingIntervalMs.set(environment.gpsPingIntervalMs);
    try {
      await Preferences.remove({ key: GPS_INTERVAL_KEY });
    } catch {
      // ignore
    }
  }

  /** Builds an absolute API URL from a relative path. */
  url(path: string): string {
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${this.apiBaseUrl}${p}`;
  }
}
