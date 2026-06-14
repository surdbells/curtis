import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { ActionBuilderService } from './action-builder.service';
import { LocationGateService } from './location-gate.service';
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
 *              Updates DayStore; starts TrackerService.
 *
 *   end()   -> POST /end_day with closing mileage, gaslevel, lat/lng
 *              Updates DayStore; stops TrackerService.
 *
 * Failures propagate. The offline interceptor will queue the POST if the
 * network is unreachable — the caller will still see a resolved promise
 * with a synthesised envelope; local state updates apply either way so
 * the agent can keep working offline.
 *
 * Location: lat/lng come from the canonical builder (LocationGate cache).
 * start_day forces a fresh refresh and demands a fix — the agent literally
 * cannot start a tracked day without GPS active.
 */
@Injectable({ providedIn: 'root' })
export class DayService {
  private readonly api = inject(ApiService);
  private readonly builder = inject(ActionBuilderService);
  private readonly locationGate = inject(LocationGateService);
  private readonly tracker = inject(TrackerService);
  private readonly dayStore = inject(DayStore);

  async start(input: StartDayInput): Promise<void> {
    await this.ensureCoords('Location required to start the day.');
    const timestamp = nowIsoUtc();
    const truckId = input.truckId ?? null;
    const routeId = input.routeId ?? null;

    const dto = await this.builder.build({
      status: 'Start Day',
      utcDateTime: timestamp,
      truckid: truckId,
      mileage: input.mileage,
      gaslevel: input.gasLevel,
    });

    await firstValueFrom(this.api.post<unknown>('/start_day', dto));

    this.dayStore.startDay({
      truckId,
      routeId,
      mileage: input.mileage,
      gasLevel: input.gasLevel,
      timestamp,
    });

    await this.tracker.start();
  }

  async end(input: EndDayInput): Promise<void> {
    await this.ensureCoords('Location required to end the day.');
    const activeTruck = this.dayStore.truckId();

    const dto = await this.builder.build({
      status: 'End Day',
      truckid: activeTruck,
      mileage: input.mileage,
      gaslevel: input.gasLevel,
    });

    await firstValueFrom(this.api.post<unknown>('/end_day', dto));

    await this.tracker.stop();
    this.dayStore.endDay();
  }

  /** Refresh coords and throw with prompt if still missing. */
  private async ensureCoords(missingMessage: string): Promise<void> {
    await this.locationGate.refresh();
    if (!this.locationGate.getLatest()) {
      void this.locationGate.promptForLocation();
      throw new Error(missingMessage);
    }
  }
}
