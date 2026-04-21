import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { SessionStore } from '../stores/session.store';

/**
 * Blocks unauthenticated access. Used on every feature route except
 * /splash, /login, and /biometric-unlock.
 */
export const authGuard: CanActivateFn = () => {
  const session = inject(SessionStore);
  const router = inject(Router);

  if (session.isAuthenticated()) return true;
  return router.parseUrl('/login');
};
