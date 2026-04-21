import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { dayStartedGuard } from './core/guards/day-started.guard';

/**
 * Lazy-loaded route table.
 *
 * Auth routes (/splash, /login, /biometric-unlock) are open. Everything
 * else requires an authenticated session via authGuard. Operational screens
 * additionally require an active day via dayStartedGuard — wired in Phase 3.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'splash' },

  {
    path: 'splash',
    loadComponent: () => import('./features/auth/splash/splash.page').then((m) => m.SplashPage),
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'biometric-unlock',
    loadComponent: () =>
      import('./features/auth/biometric-unlock/biometric-unlock.page').then((m) => m.BiometricUnlockPage),
  },

  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
  },
  {
    path: 'map',
    canActivate: [authGuard],
    loadComponent: () => import('./features/map/map.page').then((m) => m.MapPage),
  },
  {
    path: 'daily',
    canActivate: [authGuard, dayStartedGuard],
    loadComponent: () => import('./features/daily/daily.page').then((m) => m.DailyPage),
  },
  {
    path: 'delivery',
    canActivate: [authGuard, dayStartedGuard],
    loadComponent: () => import('./features/delivery/delivery.page').then((m) => m.DeliveryPage),
  },
  {
    path: 'process',
    canActivate: [authGuard, dayStartedGuard],
    loadComponent: () => import('./features/process/process.page').then((m) => m.ProcessPage),
  },
  {
    path: 'signature',
    canActivate: [authGuard, dayStartedGuard],
    loadComponent: () =>
      import('./features/signature/signature.page').then((m) => m.SignaturePage),
  },
  {
    path: 'delivery-checkout',
    canActivate: [authGuard, dayStartedGuard],
    loadComponent: () =>
      import('./features/delivery-checkout/delivery-checkout.page').then(
        (m) => m.DeliveryCheckoutPage,
      ),
  },
  {
    path: 'manual-evacuation',
    canActivate: [authGuard, dayStartedGuard],
    loadComponent: () =>
      import('./features/manual-evacuation/manual-evacuation.page').then((m) => m.ManualEvacuationPage),
  },
  {
    path: 'retail-evacuation',
    canActivate: [authGuard, dayStartedGuard],
    loadComponent: () =>
      import('./features/retail-evacuation/retail-evacuation.page').then((m) => m.RetailEvacuationPage),
  },
  {
    path: 'route-scan',
    canActivate: [authGuard, dayStartedGuard],
    loadComponent: () =>
      import('./features/route-scan/route-scan.page').then((m) => m.RouteScanPage),
  },
  {
    path: 'bank-scan',
    canActivate: [authGuard, dayStartedGuard],
    loadComponent: () =>
      import('./features/bank-scan/bank-scan.page').then((m) => m.BankScanPage),
  },
  {
    path: 'incident',
    canActivate: [authGuard, dayStartedGuard],
    loadComponent: () => import('./features/incident/incident.page').then((m) => m.IncidentPage),
  },

  { path: '**', redirectTo: 'splash' },
];
