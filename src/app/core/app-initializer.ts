import { inject, provideAppInitializer } from '@angular/core';
import { TokenService } from './services/token.service';
import { ConnectivityService } from './services/connectivity.service';
import { StorageService } from './services/storage.service';

/**
 * App initializer: runs once at bootstrap, before the first route activates.
 *
 * Order matters:
 *   1. Connectivity listeners (so the offline interceptor has signal data)
 *   2. SQLite open + schema migration (offline queue needs this)
 *   3. Token hydration (loads persisted session into SessionStore)
 *
 * We swallow errors so a local storage problem on one device doesn't brick
 * the app — the user can still log in fresh.
 */
export const appInitializerProvider = provideAppInitializer(async () => {
  const connectivity = inject(ConnectivityService);
  const storage = inject(StorageService);
  const tokens = inject(TokenService);

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
});
