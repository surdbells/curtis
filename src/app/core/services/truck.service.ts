import { Injectable, inject } from '@angular/core';
import { Observable, map, of, switchMap } from 'rxjs';
import { ApiService } from './api.service';
import type { Truck, TruckAssignment } from '../models';

/**
 * Wraps the Truck-related endpoints on the TrackingApi.
 *
 * Backend exposes two endpoints — neither alone is sufficient:
 *
 *   GET /GetTruckByUserId  → { userId, truckId }   (assignment lookup)
 *   GET /GetTrucks         → Truck[]               (all trucks)
 *
 * There is no GET /GetTruck/{id} endpoint, so `getMyTruck()` does
 * assignment → list → filter. The full truck list is ~50 entries
 * (seen in samples) so client-side filter is cheap.
 */
@Injectable({ providedIn: 'root' })
export class TruckService {
  private readonly api = inject(ApiService);

  /** GET /GetTruckByUserId — raw assignment lookup. */
  getAssignment(): Observable<TruckAssignment> {
    return this.api.get<TruckAssignment>('/GetTruckByUserId');
  }

  /** GET /GetTrucks — full fleet. Primarily for admin and resolver use. */
  getAll(): Observable<Truck[]> {
    return this.api.get<Truck[]>('/GetTrucks');
  }

  /**
   * Composite: discovers the user's assigned truck id, then resolves
   * it to a full Truck via the fleet list. Returns null when there's
   * no assignment or the truckId doesn't match any truck in the fleet
   * (the latter would indicate a backend data inconsistency, but we
   * fail soft and let the dashboard show '—').
   */
  getMyTruck(): Observable<Truck | null> {
    return this.getAssignment().pipe(
      switchMap((assignment) => {
        if (!assignment?.truckId) return of<Truck | null>(null);
        return this.getAll().pipe(
          map((trucks) => {
            if (!Array.isArray(trucks)) return null;
            return trucks.find((t) => t.id === assignment.truckId) ?? null;
          }),
        );
      }),
    );
  }
}
