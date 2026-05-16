import { bootstrapApplication } from '@angular/platform-browser';
import { defineCustomElements as defineJeepSqlite } from 'jeep-sqlite/loader';
import * as Sentry from '@sentry/angular';
import { Capacitor } from '@capacitor/core';

import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { environment } from './environments/environment';

// --- Sentry init -------------------------------------------------------------
// Must run BEFORE bootstrapApplication so the SDK can install its global
// listeners and Sentry.createErrorHandler is wired before the first tick.
// When sentryDsn is empty (the default dev configuration) we skip init —
// Sentry calls elsewhere in the app become no-ops via the SDK's own guards.
if (environment.sentryDsn) {
  try {
    Sentry.init({
      dsn: environment.sentryDsn,
      environment: environment.env,
      release: environment.sentryRelease,
      tracesSampleRate: environment.sentryTracesSampleRate,
      initialScope: {
        tags: {
          platform: Capacitor.getPlatform(),
          isNative: String(Capacitor.isNativePlatform()),
        },
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[Sentry] init failed', err);
  }
}
// -----------------------------------------------------------------------------

// Register the <jeep-sqlite> custom element so @capacitor-community/sqlite has
// a web-platform store to fall back to. On native platforms this is a no-op.
defineJeepSqlite(window);

bootstrapApplication(AppComponent, appConfig).catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  // Best-effort: forward bootstrap failures to Sentry (no-op if not init'd).
  try { Sentry.captureException(err); } catch { /* ignore */ }
});
