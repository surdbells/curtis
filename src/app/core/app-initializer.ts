import { inject, provideAppInitializer } from '@angular/core';
import { TokenService } from './services/token.service';
import { ConnectivityService } from './services/connectivity.service';
import { StorageService } from './services/storage.service';
import { ThemeService } from './services/theme.service';
import { BatteryService } from './services/battery.service';
import { OfflineQueueService } from './services/offline-queue.service';
import { OnboardingService } from './services/onboarding.service';
import { ConfigService } from './services/config.service';
import { ErrorReportingService } from './services/error-reporting.service';

/**
 * App initializer: runs once at bootstrap, before the first route activates.
 *
 * Order matters:
 *   1. ErrorReporting (sync; flips the `enabled` signal so subsequent
 *      service init failures get captured)
 *   2. Theme (synchronous, paints status bar correctly on first frame)
 *   3. Connectivity listeners (so the offline interceptor has signal data)
 *   4. SQLite open + schema migration (offline queue needs this)
 *   5. Token hydration (loads persisted session into SessionStore)
 *   6. Battery polling (fires on a 60s interval, exposes signals for UI)
 *   7. Offline queue worker (drain on reconnect / resume / 60s timer)
 *
 * We swallow errors so a local storage problem on one device doesn't brick
 * the app — the user can still log in fresh.
 */
export const appInitializerProvider = provideAppInitializer(async () => {
  const errorReporting = inject(ErrorReportingService);
  const config = inject(ConfigService);
  const theme = inject(ThemeService);
  const connectivity = inject(ConnectivityService);
  const storage = inject(StorageService);
  const tokens = inject(TokenService);
  const battery = inject(BatteryService);
  const queue = inject(OfflineQueueService);
  const onboarding = inject(OnboardingService);

  try {
    errorReporting.init();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('ErrorReporting init failed', err);
  }

  try {
    await theme.init();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Theme init failed', err);
    errorReporting.captureError(err, { feature: 'theme.init' });
  }

  try {
    await config.hydrate();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Config hydrate failed', err);
    errorReporting.captureError(err, { feature: 'config.hydrate' });
  }

  try {
    await connectivity.init();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Connectivity init failed', err);
    errorReporting.captureError(err, { feature: 'connectivity.init' });
  }

  try {
    await storage.init();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('SQLite init failed', err);
    errorReporting.captureError(err, { feature: 'storage.init' });
  }

  try {
    await tokens.hydrate();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Token hydration failed', err);
    errorReporting.captureError(err, { feature: 'tokens.hydrate' });
  }

  try {
    battery.start();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Battery init failed', err);
    errorReporting.captureError(err, { feature: 'battery.start' });
  }

  try {
    await queue.start();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Offline queue worker init failed', err);
    errorReporting.captureError(err, { feature: 'queue.start' });
  }

  try {
    await onboarding.hydrate();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Onboarding hydrate failed', err);
    errorReporting.captureError(err, { feature: 'onboarding.hydrate' });
  }
});
