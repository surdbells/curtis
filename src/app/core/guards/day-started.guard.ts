import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { DayStore } from '../stores/day.store';

/**
 * Blocks operational screens (delivery, process, evacuation, etc.) until
 * the agent has started their day. Redirects to /dashboard so the agent
 * can tap "Start Day" first.
 */
export const dayStartedGuard: CanActivateFn = () => {
  const day = inject(DayStore);
  const router = inject(Router);

  if (day.dayActive()) return true;
  return router.parseUrl('/dashboard');
};
