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
};
