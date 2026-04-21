import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { ActionBuilderService } from './action-builder.service';
import { LocationService } from './location.service';
import { StatusService } from './status.service';
import { SignatureService } from './signature.service';
import { DeliveryStore } from '../stores/delivery.store';
import { DayStore } from '../stores/day.store';
import { ACTION, STATUS } from '../models';
import { nowIsoUtc } from '../utils';

export interface CheckInInput {
  bankId: string;
  branchId: string;
  /** Optional note entered by the agent. */
  note?: string;
}

export interface ProcessInput {
  processingType?: string;
  procType?: string;
  seals?: string;
  note?: string;
}

export interface CheckOutInput {
  /** Optional note entered by the agent. */
  note?: string;
}

/**
 * Delivery flow service.
 *
 * Each call wraps the action-specific POST + a status beat, and updates
 * DeliveryStore so the UI reacts.
 *
 * TODO(phase-0): confirm required fields per POST (Check_In, check_out,
 * PostSignature) with backend. Current assumption: bankid + branchid are
 * required on check_in / check_out; signature base64 is required on
 * PostSignature.
 */
@Injectable({ providedIn: 'root' })
export class DeliveryService {
  private readonly api = inject(ApiService);
  private readonly builder = inject(ActionBuilderService);
  private readonly location = inject(LocationService);
  private readonly status = inject(StatusService);
  private readonly signatureHelper = inject(SignatureService);
  private readonly delivery = inject(DeliveryStore);
  private readonly day = inject(DayStore);

  async checkIn(input: CheckInInput): Promise<void> {
    const coords = await this.location.tryGetCurrent();
    const timestamp = nowIsoUtc();

    const dto = await this.builder.build({
      action: ACTION.CHECK_IN,
      status: STATUS.OK,
      bankid: input.bankId,
      branchid: input.branchId,
      note: input.note ?? null,
      routeid: this.day.routeId(),
      truckid: this.day.truckId(),
      utcDateTime: timestamp,
      latitude: coords ? String(coords.latitude) : null,
      longitude: coords ? String(coords.longitude) : null,
    });

    await firstValueFrom(this.api.post<unknown>('/Check_In', dto));
    this.delivery.markCheckedIn(timestamp);

    // Echo a status beat so the audit stream captures it independently.
    await this.status
      .beat({
        action: ACTION.CHECK_IN,
        bankid: input.bankId,
        branchid: input.branchId,
      })
      .catch(() => undefined);
  }

  async postProcess(input: ProcessInput): Promise<void> {
    // No dedicated /Process endpoint on the API — process state is
    // captured via PostStatusByUserId with action='process'.
    const coords = await this.location.tryGetCurrent();
    const dto = await this.builder.build({
      action: ACTION.PROCESS,
      status: STATUS.OK,
      processingtype: input.processingType ?? null,
      proctype: input.procType ?? null,
      seals: input.seals ?? null,
      note: input.note ?? null,
      bankid: this.delivery.bankId(),
      branchid: this.delivery.branchId(),
      routeid: this.day.routeId(),
      truckid: this.day.truckId(),
      latitude: coords ? String(coords.latitude) : null,
      longitude: coords ? String(coords.longitude) : null,
    });

    await firstValueFrom(this.api.post<unknown>('/PostStatusByUserId', dto));
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
    const coords = await this.location.tryGetCurrent();
    const timestamp = nowIsoUtc();

    const dto = await this.builder.build({
      action: ACTION.CHECK_OUT,
      status: STATUS.OK,
      bankid: this.delivery.bankId(),
      branchid: this.delivery.branchId(),
      routeid: this.day.routeId(),
      truckid: this.day.truckId(),
      note: input.note ?? null,
      utcDateTime: timestamp,
      latitude: coords ? String(coords.latitude) : null,
      longitude: coords ? String(coords.longitude) : null,
    });

    await firstValueFrom(this.api.post<unknown>('/check_out', dto));
    this.delivery.markCheckedOut(timestamp);

    await this.status
      .beat({
        action: ACTION.CHECK_OUT,
        bankid: this.delivery.bankId(),
        branchid: this.delivery.branchId(),
      })
      .catch(() => undefined);

    // Delivery complete — reset the store so the next stop starts fresh.
    this.delivery.clear();
  }
}
