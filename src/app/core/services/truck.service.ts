import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import type { Truck } from '../models';

/**
 * Wraps the Truck-related endpoints on the TrackingApi.
 *
 * TODO(phase-3-samples): once backend provides real response samples,
 * tighten the Truck model and remove the index signature.
 */
@Injectable({ providedIn: 'root' })
export class TruckService {
  private readonly api = inject(ApiService);

  /** GET /GetTruckByUserId — returns the truck assigned to the current user. */
  getMyTruck(): Observable<Truck> {
    return this.api.get<Truck>('/GetTruckByUserId');
  }

  /** GET /GetTrucks — returns all trucks. Primarily for admin use. */
  getAll(): Observable<Truck[]> {
    return this.api.get<Truck[]>('/GetTrucks');
  }
}
