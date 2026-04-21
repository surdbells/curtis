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
};
