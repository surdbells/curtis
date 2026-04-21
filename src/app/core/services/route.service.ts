import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import type { Route } from '../models';

/**
 * Wraps the Route-related endpoints on the TrackingApi.
 *
 * TODO(phase-3-samples): once backend provides real response samples,
 * tighten the Route and RouteStop models and remove index signatures.
 */
@Injectable({ providedIn: 'root' })
export class RouteService {
  private readonly api = inject(ApiService);

  /** GET /GetRouteByUserId — the active route for the current user. */
  getMyRoute(): Observable<Route> {
    return this.api.get<Route>('/GetRouteByUserId');
  }

  /** GET /GetRoute/{routeid} — a specific route by id. */
  getById(routeId: string): Observable<Route> {
    return this.api.get<Route>(`/GetRoute/${encodeURIComponent(routeId)}`);
  }
}
