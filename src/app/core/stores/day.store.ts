import { Injectable, computed, signal } from '@angular/core';

/**
 * Tracks the agent's operational "day" lifecycle.
 *
 * Flipped true on successful /start_day and false on /end_day.
 * Guards operational screens (delivery, process, etc.) via DayStartedGuard.
 * Drives whether background GPS tracking is active.
 */
@Injectable({ providedIn: 'root' })
export class DayStore {
  private readonly _dayActive = signal<boolean>(false);
  /** ISO 8601 UTC of the most recent start_day call. */
  private readonly _startedAt = signal<string | null>(null);
  private readonly _truckId = signal<string | null>(null);
  private readonly _routeId = signal<string | null>(null);
  private readonly _openingMileage = signal<string | null>(null);
  private readonly _openingGasLevel = signal<string | null>(null);

  readonly dayActive = this._dayActive.asReadonly();
  readonly startedAt = this._startedAt.asReadonly();
  readonly truckId = this._truckId.asReadonly();
  readonly routeId = this._routeId.asReadonly();
  readonly openingMileage = this._openingMileage.asReadonly();
  readonly openingGasLevel = this._openingGasLevel.asReadonly();

  readonly summary = computed(() => ({
    active: this._dayActive(),
    startedAt: this._startedAt(),
    truckId: this._truckId(),
    routeId: this._routeId(),
  }));

  startDay(args: {
    truckId: string;
    routeId: string;
    mileage: string;
    gasLevel: string;
    timestamp: string;
  }): void {
    this._dayActive.set(true);
    this._truckId.set(args.truckId);
    this._routeId.set(args.routeId);
    this._openingMileage.set(args.mileage);
    this._openingGasLevel.set(args.gasLevel);
    this._startedAt.set(args.timestamp);
  }

  endDay(): void {
    this._dayActive.set(false);
    this._startedAt.set(null);
    this._truckId.set(null);
    this._routeId.set(null);
    this._openingMileage.set(null);
    this._openingGasLevel.set(null);
  }
}
