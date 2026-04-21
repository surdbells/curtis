import { Injectable, computed, signal } from '@angular/core';
import type { Route, RouteStop } from '../models';

/**
 * Holds the active route and stop progression for the current day.
 * Populated after a successful /GetRouteByUserId call on the Dashboard.
 */
@Injectable({ providedIn: 'root' })
export class RouteStore {
  private readonly _route = signal<Route | null>(null);
  private readonly _currentStopIndex = signal<number>(0);

  readonly route = this._route.asReadonly();
  readonly currentStopIndex = this._currentStopIndex.asReadonly();

  readonly stops = computed<RouteStop[]>(() => this._route()?.stops ?? []);
  readonly currentStop = computed<RouteStop | null>(() => {
    const stops = this.stops();
    const idx = this._currentStopIndex();
    return stops[idx] ?? null;
  });
  readonly remainingStops = computed<RouteStop[]>(() => this.stops().slice(this._currentStopIndex()));

  setRoute(route: Route | null): void {
    this._route.set(route);
    this._currentStopIndex.set(0);
  }

  advance(): void {
    const next = this._currentStopIndex() + 1;
    const max = this.stops().length;
    this._currentStopIndex.set(Math.min(next, max));
  }

  clear(): void {
    this._route.set(null);
    this._currentStopIndex.set(0);
  }
}
