import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { BehaviorSubject, catchError, filter, from, switchMap, take, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { SessionStore } from '../stores/session.store';
import { ConfigService } from '../services/config.service';

/**
 * Handles 401 Unauthorized on protected endpoints by:
 *   1. Suspending the failed request
 *   2. Calling AuthService.refresh() (once; subsequent 401s wait for the first)
 *   3. On success, replaying all waiting requests with the new token
 *   4. On failure, clearing session state (guards will redirect to login)
 *
 * TODO(phase-0): verify /refresh endpoint shape with backend. If the endpoint
 * differs, update AuthService.refresh() only — this interceptor stays generic.
 */
let isRefreshing = false;
const refreshed$ = new BehaviorSubject<string | null>(null);

export const refreshInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const session = inject(SessionStore);
  const config = inject(ConfigService);

  const isApi = req.url.startsWith(config.apiBaseUrl);
  const isAuthEndpoint =
    req.url.endsWith('/login') || req.url.endsWith('/refresh');

  if (!isApi || isAuthEndpoint) {
    return next(req);
  }

  return next(req).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401) {
        return throwError(() => err);
      }
      return handle401(req, next, auth, session);
    }),
  );
};

function handle401(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  auth: AuthService,
  session: SessionStore,
) {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshed$.next(null);

    return from(
      (async () => {
        try {
          // AuthService.refresh is an Observable; convert the first emission to a promise.
          await new Promise<void>((resolve, reject) => {
            const sub = auth.refresh().subscribe({
              next: () => {
                resolve();
                sub.unsubscribe();
              },
              error: (e) => {
                reject(e);
                sub.unsubscribe();
              },
            });
          });
        } finally {
          isRefreshing = false;
        }
        return session.accessToken();
      })(),
    ).pipe(
      switchMap((newToken) => {
        refreshed$.next(newToken);
        if (!newToken) {
          session.clear();
          return throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Refresh failed' }));
        }
        return next(req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } }));
      }),
      catchError((e) => {
        session.clear();
        return throwError(() => e);
      }),
    );
  }

  // Refresh already in flight — wait for it.
  return refreshed$.pipe(
    filter((t): t is string => t !== null),
    take(1),
    switchMap((t) => next(req.clone({ setHeaders: { Authorization: `Bearer ${t}` } }))),
  );
}
