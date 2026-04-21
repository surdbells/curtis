import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

/**
 * Last-in-chain error hook. Logs (dev only) and re-throws so callers can
 * still react. UI-level error toasts live in feature code, not here.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        // eslint-disable-next-line no-console
        console.warn(`[API ${err.status}] ${req.method} ${req.url}`, err.error);
      }
      return throwError(() => err);
    }),
  );
