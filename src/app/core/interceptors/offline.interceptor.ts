import { HttpInterceptorFn, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, of, switchMap, throwError } from 'rxjs';
import { OfflineQueueService } from '../services/offline-queue.service';
import { ConnectivityService } from '../services/connectivity.service';
import { ConfigService } from '../services/config.service';

/**
 * For POSTs that fail with a network error (status 0) or that are fired
 * while the device is offline, persist the request to the offline queue and
 * resolve with a synthesised 202 Accepted so the UI can continue.
 *
 * GETs are never queued — they just fail and the UI shows cached data.
 *
 * Phase 1 ships the wiring; the replay loop lives in OfflineQueueService
 * (Phase 7).
 *
 * TODO(phase-7): decide UX — today's synthesised 202 returns an empty body
 * which would break any caller expecting unwrapped data. For Phase 7 we'll
 * return a typed "pending" marker and update ApiService to recognise it.
 */
export const offlineInterceptor: HttpInterceptorFn = (req, next) => {
  const queue = inject(OfflineQueueService);
  const net = inject(ConnectivityService);
  const config = inject(ConfigService);

  const isApi = req.url.startsWith(config.apiBaseUrl);
  const isQueueable = req.method === 'POST' && !req.url.endsWith('/login') && !req.url.endsWith('/refresh');

  // Fast-path: if we're known-offline at dispatch time, short-circuit to queue.
  if (isApi && isQueueable && !net.online()) {
    return from(queue.enqueue({ url: req.url, body: req.body })).pipe(
      switchMap(() => of(new HttpResponse<{ status: string; message: string }>({
        status: 202,
        body: { status: '0', message: 'Queued offline' },
      }))),
    );
  }

  return next(req).pipe(
    catchError((err: unknown) => {
      const isNetworkErr = err instanceof HttpErrorResponse && (err.status === 0 || err.status >= 500);
      if (isApi && isQueueable && isNetworkErr) {
        return from(queue.enqueue({ url: req.url, body: req.body })).pipe(
          switchMap(() => of(new HttpResponse<{ status: string; message: string }>({
            status: 202,
            body: { status: '0', message: 'Queued offline' },
          }))),
        );
      }
      return throwError(() => err);
    }),
  );
};
