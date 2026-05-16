/**
 * Development environment configuration.
 *
 * NOTE: All environment keys are mirrored in environment.prod.ts and environment.staging.ts.
 * Keep them in sync when adding a new key.
 */
export const environment = {
  production: false,
  env: 'dev' as const,

  /** Base URL for the TrackingApi v1. */
  apiBaseUrl: 'https://bwtrackapi2.betacrest.com',

  /** Identifies this client app to the backend (per Phase 0 confirmation). */
  appId: 'ViewHot',

  /**
   * JWT refresh window. When the token has fewer than this many seconds
   * remaining, the refresh interceptor will proactively refresh before the
   * next request. Access tokens currently live ~30 minutes.
   */
  tokenRefreshThresholdSec: 60,

  /** Interval (ms) at which PostDeviceLocation pings are sent during an active day. */
  gpsPingIntervalMs: 30_000,

  /** Max retry attempts for a queued offline request before surfacing to the user. */
  offlineQueueMaxRetries: 10,

  /** Base URL for Leaflet OSM tiles. */
  mapTileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  mapAttribution: '&copy; OpenStreetMap contributors',

  /**
   * Sentry error reporting.
   *
   * When `sentryDsn` is an empty string, Sentry is initialised as a no-op
   * — no requests are made and no events are captured. This is the
   * expected dev configuration; populate it via the env-var-replacement
   * step at build time (or paste the DSN literal in for local debug).
   *
   * `tracesSampleRate` controls performance/tracing transactions
   * (Sentry distributes load via probabilistic sampling). 0.0 disables
   * tracing entirely; 1.0 captures every transaction. Dev defaults to
   * 0 so a developer running the app doesn't ship tracing data.
   */
  sentryDsn: '',
  sentryTracesSampleRate: 0,
  sentryRelease: 'curtis@0.1.0+dev',
};
