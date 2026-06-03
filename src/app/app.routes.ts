import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

/**
 * Lazy-loaded route table.
 *
 * Auth routes (/splash, /login, /biometric-unlock) are open. Everything
 * else requires an authenticated session via authGuard. There is no
 * route-level day-started gate — operational screens are reachable from
 * the dashboard at any time. Per-page inline guards (e.g. the "Not
 * checked in" banner on process/signature) still prevent submission
 * when the agent is mid-flow without an active day.
 *
 * The dayStartedGuard remains in core/guards/ as reusable policy
 * infrastructure, in case any future flow needs to enforce day-started
 * at the route level.
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
    path: 'onboarding',
    canActivate: [authGuard],
    loadComponent: () => import('./features/onboarding/onboarding.page').then((m) => m.OnboardingPage),
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
    canActivate: [authGuard],
    loadComponent: () => import('./features/daily/daily.page').then((m) => m.DailyPage),
  },
  {
    path: 'delivery',
    canActivate: [authGuard],
    loadComponent: () => import('./features/delivery/delivery.page').then((m) => m.DeliveryPage),
  },
  {
    path: 'process',
    canActivate: [authGuard],
    loadComponent: () => import('./features/process/process.page').then((m) => m.ProcessPage),
  },
  {
    path: 'signature',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/signature/signature.page').then((m) => m.SignaturePage),
  },
  {
    path: 'delivery-checkout',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/delivery-checkout/delivery-checkout.page').then(
        (m) => m.DeliveryCheckoutPage,
      ),
  },
  {
    path: 'manual-evacuation',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/manual-evacuation/manual-evacuation.page').then((m) => m.ManualEvacuationPage),
  },
  {
    path: 'retail-evacuation',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/retail-evacuation/retail-evacuation.page').then((m) => m.RetailEvacuationPage),
  },
  {
    path: 'route-scan',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/route-scan/route-scan.page').then((m) => m.RouteScanPage),
  },
  {
    path: 'bank-scan',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/bank-scan/bank-scan.page').then((m) => m.BankScanPage),
  },
  {
    path: 'incident',
    canActivate: [authGuard],
    loadComponent: () => import('./features/incident/incident.page').then((m) => m.IncidentPage),
  },
  {
    path: 'queue',
    canActivate: [authGuard],
    loadComponent: () => import('./features/queue/queue.page').then((m) => m.QueuePage),
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () => import('./features/settings/settings.page').then((m) => m.SettingsPage),
  },

  { path: '**', redirectTo: 'splash' },
];
