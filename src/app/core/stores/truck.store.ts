import { Injectable, signal } from '@angular/core';
import type { Truck } from '../models';

/**
 * Holds the currently-assigned truck for the authenticated user.
 * Populated after a successful /GetTruckByUserId call.
 */
@Injectable({ providedIn: 'root' })
export class TruckStore {
  private readonly _truck = signal<Truck | null>(null);
  readonly truck = this._truck.asReadonly();

  set(truck: Truck | null): void {
    this._truck.set(truck);
  }

  clear(): void {
    this._truck.set(null);
  }
}
