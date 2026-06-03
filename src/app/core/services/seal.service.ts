import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { ActionBuilderService } from './action-builder.service';
import { LocationService } from './location.service';
import { SessionStore } from '../stores/session.store';
import { DayStore } from '../stores/day.store';
import { ACTION, STATUS } from '../models';
import type { Seal } from '../models';

export interface PostSealsInput {
  /** Seal record IDs the agent successfully scanned/confirmed. */
  sealIds: string[];
  /** Optional note from the agent. */
  note?: string;
}

/**
 * Incoming-seals endpoints.
 *
 * GET  /GetIncomingSealsByRoute/{routeId}/{userId}
 * GET  /GetIncomingSealsByBank/{bankId}/{userId}
 * POST /PostIncomingSealsByRoute
 * POST /PostIncomingSealsByBank
 *
 * Seal serialisation on POST:
 *   The legacy CurtisTracker Android app sends the list of confirmed seal
 *   IDs as a comma-separated string in the `seals` field:
 *       seals='id1,id2,id3'
 *   (Source: BankActivity.java / RouteActivity.java -> String.valueOf
 *   on List<String> then strip [ ] and spaces.)
 *
 * TODO(phase-5-samples): tighten the Seal model with field names from a
 * real /GetIncomingSealsBy* response sample.
 */
@Injectable({ providedIn: 'root' })
export class SealService {
  private readonly api = inject(ApiService);
  private readonly builder = inject(ActionBuilderService);
  private readonly location = inject(LocationService);
  private readonly session = inject(SessionStore);
  private readonly day = inject(DayStore);

  /** GET seals for the active route + current user. */
  getIncomingByRoute(routeId: string): Observable<Seal[]> {
    const userId = this.session.userId() ?? '';
    const path = `/GetIncomingSealsByRoute/${encodeURIComponent(routeId)}/${encodeURIComponent(userId)}`;
    return this.api.get<Seal[]>(path);
  }

  /** GET seals for a bank + current user. */
  getIncomingByBank(bankId: string): Observable<Seal[]> {
    const userId = this.session.userId() ?? '';
    const path = `/GetIncomingSealsByBank/${encodeURIComponent(bankId)}/${encodeURIComponent(userId)}`;
    return this.api.get<Seal[]>(path);
  }

  async postIncomingByRoute(input: PostSealsInput): Promise<void> {
    const dto = await this.buildDto(input, ACTION.INCOMING_SEALS_ROUTE, {
      routeid: this.day.routeId(),
    });
    await firstValueFrom(this.api.post<unknown>('/PostIncomingSealsByRoute', dto));
  }

  async postIncomingByBank(bankId: string, input: PostSealsInput): Promise<void> {
    const dto = await this.buildDto(input, ACTION.INCOMING_SEALS_BANK, {
      bankid: bankId,
    });
    await firstValueFrom(this.api.post<unknown>('/PostIncomingSealsByBank', dto));
  }

  /** Serialise seal IDs the way the legacy backend expects. */
  serialiseSealIds(ids: readonly string[]): string {
    return ids.filter(Boolean).join(',');
  }

  private async buildDto(
    input: PostSealsInput,
    action: string,
    extras: Record<string, string | null>,
  ) {
    const coords = await this.location.tryGetCurrent();
    return this.builder.build({
      action,
      status: STATUS.OK,
      seals: this.serialiseSealIds(input.sealIds),
      note: input.note ?? null,
      truckid: this.day.truckId(),
      routeid: this.day.routeId(),
      latitude: coords ? String(coords.latitude) : null,
      longitude: coords ? String(coords.longitude) : null,
      ...extras,
    });
  }
}
