import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { ActionBuilderService } from './action-builder.service';
import { LocationService } from './location.service';
import { TrackerService } from './tracker.service';
import { DayStore } from '../stores/day.store';
import { nowIsoUtc } from '../utils';

export interface StartDayInput {
  /** Optional. Backend accepts null if no truck is assigned at start. */
  truckId?: string | null;
  /** Optional. Backend accepts null if no route is assigned at start. */
  routeId?: string | null;
  mileage: string;
  gasLevel: string;
}

export interface EndDayInput {
  mileage: string;
  gasLevel: string;
}

/**
 * Orchestrates the day lifecycle.
 *
 *   start() -> POST /start_day with truckid, routeid, mileage, gaslevel,
 *              latitude, longitude, utcDateTime, deviceId, userid
 *              Updates DayStore; starts TrackerService (phase-6 skeleton).
 *
 *   end()   -> POST /end_day with closing mileage, gaslevel, lat/lng
 *              Updates DayStore; stops TrackerService.
 *
 * Failures propagate. The offline interceptor will queue the POST if the
 * network is unreachable — the caller will still see a resolved promise
 * with a synthesised envelope; local state updates apply either way so
 * the agent can keep working offline.
 *
 * TODO(phase-0): confirm exact `action` / `status` values the backend
 * expects on start_day / end_day. Current assumption: action='start_day'
 * and action='end_day' (matching the endpoint paths).
 */
@Injectable({ providedIn: 'root' })
export class DayService {
  private readonly api = inject(ApiService);
  private readonly builder = inject(ActionBuilderService);
  private readonly location = inject(LocationService);
  private readonly tracker = inject(TrackerService);
  private readonly dayStore = inject(DayStore);

  async start(input: StartDayInput): Promise<void> {
    const coords = await this.location.tryGetCurrent();
    const timestamp = nowIsoUtc();
    const truckId = input.truckId ?? null;
    const routeId = input.routeId ?? null;
    // Wire payload (backend spec):
    //   truckid, mileage, gaslevel, userid, utcDateTime, status ('StartDay'),
    //   deviceId, longitude, latitude
    // Builder auto-fills deviceId/utcDateTime/userid/batterystatus.
    // NOTE: action and routeid are intentionally omitted per the spec.
    const dto = await this.builder.build({
      status: 'StartDay',
      utcDateTime: timestamp,
      truckid: truckId,
      mileage: input.mileage,
      gaslevel: input.gasLevel,
      latitude: coords ? String(coords.latitude) : null,
      longitude: coords ? String(coords.longitude) : null,
    });

    await firstValueFrom(this.api.post<unknown>('/start_day', dto));

    this.dayStore.startDay({
      truckId,
      routeId,
      mileage: input.mileage,
      gasLevel: input.gasLevel,
      timestamp,
    });

    // Background GPS — phase-6 skeleton. Safe to call now; does nothing yet.
    await this.tracker.start();
  }

  async end(input: EndDayInput): Promise<void> {
    const coords = await this.location.tryGetCurrent();
    const activeTruck = this.dayStore.truckId();

    // Wire payload (backend spec):
    //   truckid, mileage, gaslevel, userid, utcDateTime, status ('EndDay'),
    //   deviceId, longitude, latitude
    // NOTE: action and routeid are intentionally omitted per the spec.
    const dto = await this.builder.build({
      status: 'EndDay',
      truckid: activeTruck,
      mileage: input.mileage,
      gaslevel: input.gasLevel,
      latitude: coords ? String(coords.latitude) : null,
      longitude: coords ? String(coords.longitude) : null,
    });

    await firstValueFrom(this.api.post<unknown>('/end_day', dto));

    await this.tracker.stop();
    this.dayStore.endDay();
  }
}
