import { inject, provideAppInitializer } from '@angular/core';
import { TokenService } from './services/token.service';
import { ConnectivityService } from './services/connectivity.service';
import { StorageService } from './services/storage.service';
import { ThemeService } from './services/theme.service';
import { BatteryService } from './services/battery.service';

/**
 * App initializer: runs once at bootstrap, before the first route activates.
 *
 * Order matters:
 *   1. Theme (synchronous, paints status bar correctly on first frame)
 *   2. Connectivity listeners (so the offline interceptor has signal data)
 *   3. SQLite open + schema migration (offline queue needs this)
 *   4. Token hydration (loads persisted session into SessionStore)
 *   5. Battery polling (fires on a 60s interval, exposes signals for UI)
 *
 * We swallow errors so a local storage problem on one device doesn't brick
 * the app — the user can still log in fresh.
 */
export const appInitializerProvider = provideAppInitializer(async () => {
  const theme = inject(ThemeService);
  const connectivity = inject(ConnectivityService);
  const storage = inject(StorageService);
  const tokens = inject(TokenService);
  const battery = inject(BatteryService);

  try {
    theme.init();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Theme init failed', err);
  }

  try {
    await connectivity.init();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Connectivity init failed', err);
  }

  try {
    await storage.init();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('SQLite init failed', err);
  }

  try {
    await tokens.hydrate();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Token hydration failed', err);
  }

  try {
    battery.start();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Battery init failed', err);
  }
});
