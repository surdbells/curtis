import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { RouteReuseStrategy } from '@angular/router';

import { routes } from './app.routes';
import { httpInterceptors } from './core/interceptors';
import { appInitializerProvider } from './core/app-initializer';

/**
 * Root provider config for standalone bootstrap.
 *
 * Interceptor order is defined in core/interceptors/index.ts and applied here
 * via withInterceptors(httpInterceptors).
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
    appInitializerProvider,
  ],
};
