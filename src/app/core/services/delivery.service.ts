import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { ActionBuilderService } from './action-builder.service';
import { LocationService } from './location.service';
import { SignatureService } from './signature.service';
import { DeliveryStore } from '../stores/delivery.store';
import { DayStore } from '../stores/day.store';
import { ACTION, STATUS } from '../models';
import { nowIsoUtc } from '../utils';

export interface CheckInInput {
  branchId: string;
  /** Optional note entered by the agent. */
  note?: string;
}

/**
 * Canonical status values posted to /PostStatusByUserId from the Status
 * step (between Scan and Sign in the stop hub).
 *
 * Spelling and casing are intentionally exactly as the backend expects.
 */
export type DeliveryStatus = 'PICKED UP' | 'IN-TRANSIT' | 'DELIVERED' | 'COMPLETED';

export const DELIVERY_STATUSES: readonly DeliveryStatus[] = [
  'PICKED UP',
  'IN-TRANSIT',
  'DELIVERED',
  'COMPLETED',
] as const;

export interface CheckOutInput {
  /** Optional note entered by the agent. */
  note?: string;
}

/**
 * Delivery flow service.
 *
 * Each call wraps the action-specific POST and updates DeliveryStore so the
 * UI reacts. Wire payloads are aligned with the canonical backend spec —
 * only the fields the backend names are sent (plus the builder's auto-
 * injected deviceId / userid / utcDateTime / batterystatus).
 */
@Injectable({ providedIn: 'root' })
export class DeliveryService {
  private readonly api = inject(ApiService);
  private readonly builder = inject(ActionBuilderService);
  private readonly location = inject(LocationService);
  private readonly signatureHelper = inject(SignatureService);
  private readonly delivery = inject(DeliveryStore);
  private readonly day = inject(DayStore);

  async checkIn(input: CheckInInput): Promise<void> {
    const refnumber = this.delivery.stopId();
    if (!refnumber) {
      throw new Error('No active stop selected. Open a stop from the Delivery list first.');
    }
    const coords = await this.location.tryGetCurrent();
    const timestamp = nowIsoUtc();

    // Wire payload (backend spec):
    //   refnumber, userid, utcDateTime, action='check_in', deviceId,
    //   longitude, latitude, branchid, note (optional per C1)
    // Builder auto-fills deviceId/utcDateTime/userid/batterystatus.
    // NOTE: bankid, truckid, routeid, status are intentionally omitted.
    const dto = await this.builder.build({
      action: ACTION.CHECK_IN,
      refnumber,
      branchid: input.branchId,
      note: input.note ?? null,
      utcDateTime: timestamp,
      latitude: coords ? String(coords.latitude) : null,
      longitude: coords ? String(coords.longitude) : null,
    });

    await firstValueFrom(this.api.post<unknown>('/Check_In', dto));
    this.delivery.markCheckedIn(timestamp);
  }

  /**
   * Status step (between Scan and Sign in the stop hub). Posts the user-
   * selected status to /PostStatusByUserId.
   *
   * Wire payload (backend spec):
   *   refnumber, userid, utcDateTime, status
   * Builder adds deviceId + batterystatus too; harmless extras.
   *
   * On success, DeliveryStore.statusUpdate is set so the stepper can
   * advance to the Sign step.
   */
  async postStatus(status: DeliveryStatus): Promise<void> {
    const refnumber = this.delivery.stopId();
    if (!refnumber) {
      throw new Error('No active stop selected.');
    }
    const dto = await this.builder.build({
      refnumber,
      status,
      utcDateTime: nowIsoUtc(),
    });

    await firstValueFrom(this.api.post<unknown>('/PostStatusByUserId', dto));
    this.delivery.markStatusUpdated(status);
    this.delivery.markProcessComplete();
  }

  async postSignature(signatureDataUrlOrBase64: string): Promise<void> {
    const raw = this.signatureHelper.toRawBase64(signatureDataUrlOrBase64);
    const coords = await this.location.tryGetCurrent();

    const dto = await this.builder.build({
      action: ACTION.SIGNATURE,
      status: STATUS.OK,
      signature: raw,
      bankid: this.delivery.bankId(),
      branchid: this.delivery.branchId(),
      routeid: this.day.routeId(),
      truckid: this.day.truckId(),
      latitude: coords ? String(coords.latitude) : null,
      longitude: coords ? String(coords.longitude) : null,
    });

    await firstValueFrom(this.api.post<unknown>('/PostSignature', dto));
    this.delivery.setSignature(raw);
  }

  async checkOut(input: CheckOutInput = {}): Promise<void> {
    const refnumber = this.delivery.stopId();
    if (!refnumber) {
      throw new Error('No active stop selected.');
    }
    const coords = await this.location.tryGetCurrent();
    const timestamp = nowIsoUtc();

    // Wire payload (backend spec):
    //   refnumber, userid, utcDateTime, action='check_out', deviceId,
    //   longitude, latitude, branchid, note (optional per C1)
    // NOTE: bankid, truckid, routeid, status are intentionally omitted.
    const dto = await this.builder.build({
      action: ACTION.CHECK_OUT,
      refnumber,
      branchid: this.delivery.branchId(),
      note: input.note ?? null,
      utcDateTime: timestamp,
      latitude: coords ? String(coords.latitude) : null,
      longitude: coords ? String(coords.longitude) : null,
    });

    await firstValueFrom(this.api.post<unknown>('/check_out', dto));
    this.delivery.markCheckedOut(timestamp);

    // Delivery complete — reset the store so the next stop starts fresh.
    this.delivery.clear();
  }
}
