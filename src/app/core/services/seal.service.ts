import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { ActionBuilderService } from './action-builder.service';
import { SessionStore } from '../stores/session.store';
import type { Seal } from '../models';

export interface PostSealsInput {
  /** Seal record IDs the agent successfully scanned/confirmed. */
  sealIds: string[];
  /** Optional note from the agent (improvement over legacy). */
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
 * Wire-shape parity with legacy:
 *   RouteActivity posts: seals, userid, DateTime, routeid, batterylevel
 *   BankActivity  posts: seals, userid, DateTime, bankid,  batterylevel
 *   We match — no action, no status, no truckid, no lat/lng. The canonical
 *   builder fills every other canonical field with "". `note` is the one
 *   intentional improvement.
 */
@Injectable({ providedIn: 'root' })
export class SealService {
  private readonly api = inject(ApiService);
  private readonly builder = inject(ActionBuilderService);
  private readonly session = inject(SessionStore);

  /** GET seals for a route + current user. */
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

  /**
   * POST /PostIncomingSealsByRoute.
   * @param routeId  The route code picked by the agent (e.g. "2a", "777").
   *                 Matches legacy RouteActivity which sent the spinner
   *                 selection — NOT the route's internal UUID.
   */
  async postIncomingByRoute(routeId: string, input: PostSealsInput): Promise<void> {
    const dto = await this.builder.build({
      seals: this.serialiseSealIds(input.sealIds),
      routeid: routeId,
      note: input.note ?? null,
    });
    await firstValueFrom(this.api.post<unknown>('/PostIncomingSealsByRoute', dto));
  }

  /**
   * POST /PostIncomingSealsByBank.
   * @param bankId  The bank's clientid from the picker (UUID string).
   */
  async postIncomingByBank(bankId: string, input: PostSealsInput): Promise<void> {
    const dto = await this.builder.build({
      seals: this.serialiseSealIds(input.sealIds),
      bankid: bankId,
      note: input.note ?? null,
    });
    await firstValueFrom(this.api.post<unknown>('/PostIncomingSealsByBank', dto));
  }

  /** Serialise seal IDs the way the legacy backend expects. */
  serialiseSealIds(ids: readonly string[]): string {
    return ids.filter(Boolean).join(',');
  }
}
