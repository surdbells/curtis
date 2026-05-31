import { Injectable, inject } from '@angular/core';
import { Observable, map, of, switchMap } from 'rxjs';
import { ApiService } from './api.service';
import type { Route, RouteAssignment, RouteStop } from '../models';

/**
 * Wraps the Route-related endpoints on the TrackingApi.
 *
 * Backend exposes two endpoints — neither alone is sufficient:
 *
 *   GET /GetRouteByUserId    → { userId, routeId }     (assignment lookup)
 *   GET /GetRoute/{routeid}  → RouteStop[]             (jobs/stops)
 *
 * `getMyRoute()` composes them into a single `Route` for the caller.
 * If the user has no assigned route (or the routeId resolves to an
 * empty job list), it resolves to `null`.
 */
@Injectable({ providedIn: 'root' })
export class RouteService {
  private readonly api = inject(ApiService);

  /** GET /GetRouteByUserId — raw assignment lookup, no detail. */
  getAssignment(): Observable<RouteAssignment> {
    return this.api.get<RouteAssignment>('/GetRouteByUserId');
  }

  /**
   * GET /GetRoute/{routeid} — jobs/stops for the given route id.
   *
   * Returns the raw array. Useful when a caller already has a routeId
   * in hand (e.g. from DayStore.routeId() after Start Day).
   */
  getById(routeId: string): Observable<RouteStop[]> {
    return this.api.get<RouteStop[]>(`/GetRoute/${encodeURIComponent(routeId)}`);
  }

  /**
   * Composite: discovers the user's assigned route id, then fetches its
   * stops, then assembles a Route. Returns null when there's no
   * assignment or the route has no stops.
   *
   * The route's display name is derived from the first stop's
   * `clientName` — in practice all stops on a single route share the
   * same client bank.
   */
  getMyRoute(): Observable<Route | null> {
    return this.getAssignment().pipe(
      switchMap((assignment) => {
        if (!assignment?.routeId) return of<Route | null>(null);
        return this.getById(assignment.routeId).pipe(
          map((stops) => {
            if (!Array.isArray(stops) || stops.length === 0) return null;
            // Sort by stopNumber to guarantee stable order regardless of
            // backend ordering. Backend appears to return them in order
            // already, but explicit > implicit.
            const sorted = [...stops].sort((a, b) => a.stopNumber - b.stopNumber);
            return {
              routeId: assignment.routeId,
              clientName: sorted[0]?.clientName ?? 'Active route',
              stops: sorted,
            } satisfies Route;
          }),
        );
      }),
    );
  }
}
