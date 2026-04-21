import { HttpInterceptorFn } from '@angular/common/http';
import { jwtInterceptor } from './jwt.interceptor';
import { refreshInterceptor } from './refresh.interceptor';
import { offlineInterceptor } from './offline.interceptor';
import { errorInterceptor } from './error.interceptor';

export { jwtInterceptor, refreshInterceptor, offlineInterceptor, errorInterceptor };

/**
 * Ordered list passed to withInterceptors() in app.config.ts.
 *
 * Order matters:
 *   1. jwt          — attach token to outbound request
 *   2. refresh      — catch 401, refresh, retry with new token
 *   3. offline      — catch network errors, enqueue, synthesise 202
 *   4. error        — logging tail
 */
export const httpInterceptors: HttpInterceptorFn[] = [
  jwtInterceptor,
  refreshInterceptor,
  offlineInterceptor,
  errorInterceptor,
];
