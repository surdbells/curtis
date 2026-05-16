export const environment = {
  production: true,
  env: 'prod' as const,

  apiBaseUrl: 'https://bwtrackapi2.betacrest.com',
  appId: 'ViewHot',

  tokenRefreshThresholdSec: 60,
  gpsPingIntervalMs: 30_000,
  offlineQueueMaxRetries: 10,

  mapTileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  mapAttribution: '&copy; OpenStreetMap contributors',

  /** Sentry — TODO: paste the production project's DSN here (or inject at build time). */
  sentryDsn: '',
  sentryTracesSampleRate: 0.1, // 10% of transactions in prod
  sentryRelease: 'curtis@0.1.0+prod',
};
