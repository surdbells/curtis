import { ApplicationConfig, ErrorHandler, inject, provideZoneChangeDetection, provideAppInitializer } from '@angular/core';
import { provideRouter, withPreloading, PreloadAllModules, Router } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { RouteReuseStrategy } from '@angular/router';
import * as Sentry from '@sentry/angular';

import { routes } from './app.routes';
import { httpInterceptors } from './core/interceptors';
import { appInitializerProvider } from './core/app-initializer';

/**
 * Root provider config for standalone bootstrap.
 *
 * Interceptor order is defined in core/interceptors/index.ts and applied here
 * via withInterceptors(httpInterceptors).
 *
 * Sentry wiring (Phase 8):
 *   - ErrorHandler is replaced by Sentry's. Sentry's handler swallows the
 *     error after capture so the default Angular console.error still runs.
 *   - TraceService activates automatic route-change transaction
 *     instrumentation when sentryTracesSampleRate > 0. We register the
 *     factory unconditionally — when the DSN is empty (no-op mode) the
 *     SDK no-ops too, so this is safe.
 *   - The Router token is injected into TraceService via provideAppInitializer
 *     (Sentry's documented pattern for standalone apps).
 */
export const appConfig: ApplicationConfig = {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular({
      mode: 'md', // consistent Material look across iOS and Android
    }),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(withInterceptors(httpInterceptors)),

    // --- Sentry wiring -----------------------------------------------------
    {
      provide: ErrorHandler,
      useValue: Sentry.createErrorHandler({
        // Show the original Angular console output too so dev can debug locally.
        showDialog: false,
      }),
    },
    {
      provide: Sentry.TraceService,
      deps: [Router],
    },
    provideAppInitializer(() => {
      // Touch the TraceService so it constructs and starts listening to
      // Router events. The return value is intentionally ignored.
      inject(Sentry.TraceService);
    }),
    // -----------------------------------------------------------------------

    appInitializerProvider,
  ],
};
