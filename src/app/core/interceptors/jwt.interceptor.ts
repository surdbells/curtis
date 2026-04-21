import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SessionStore } from '../stores/session.store';
import { ConfigService } from '../services/config.service';

/**
 * Attaches `Authorization: Bearer <token>` to any outbound request that
 * targets the configured API base URL and is not a login/refresh call.
 *
 * Login and refresh deliberately bypass this interceptor (they either have
 * no token yet or need to send the refresh token in the body, not header).
 */
export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SessionStore);
  const config = inject(ConfigService);

  const isApi = req.url.startsWith(config.apiBaseUrl);
  const isAuthEndpoint =
    req.url.endsWith('/login') || req.url.endsWith('/refresh');

  const token = session.accessToken();
  if (!isApi || isAuthEndpoint || !token) {
    return next(req);
  }

  const authed = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });
  return next(authed);
};
