import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { ActionBuilderService } from './action-builder.service';
import { LocationService } from './location.service';
import { SignatureService } from './signature.service';
import { DayStore } from '../stores/day.store';
import { ACTION, STATUS } from '../models';

export interface ManualEvacuationInput {
  bankId: string;
  branchId: string;
  destinationBranchId?: string;
  processingType?: string;
  sealIds: string[];
  note?: string;
}

export interface RetailEvacuationInput {
  retailerId: string;
  retailerBranchId: string;
  /** Base64-encoded JPEG of the captured receipt. */
  imageBase64: string;
  refNumber?: string;
  note?: string;
}

/**
 * Manual + retail evacuation flows.
 *
 *   POST /PostManualEvacuation      — agent-initiated evacuation without
 *                                     the standard route flow
 *   POST /PostEvacuationReceipt     — retail-store cash pickup
 *
 * Field requirements derived from legacy CurtisTracker ManualActivity and
 * RetailActivity. Seals serialised as comma-separated IDs (matches the
 * convention also used by Process/DeliveryService for the per-stop seal
 * list captured during the Delivery flow).
 */
@Injectable({ providedIn: 'root' })
export class EvacuationService {
  private readonly api = inject(ApiService);
  private readonly builder = inject(ActionBuilderService);
  private readonly location = inject(LocationService);
  private readonly signatureHelper = inject(SignatureService);
  private readonly day = inject(DayStore);

  async postManual(input: ManualEvacuationInput): Promise<void> {
    const coords = await this.location.tryGetCurrent();
    const dto = await this.builder.build({
      action: ACTION.MANUAL_EVACUATION,
      status: STATUS.OK,
      bankid: input.bankId,
      branchid: input.branchId,
      destinationbranchid: input.destinationBranchId ?? null,
      processingtype: input.processingType ?? null,
      seals: input.sealIds.filter(Boolean).join(','),
      note: input.note ?? null,
      routeid: this.day.routeId(),
      truckid: this.day.truckId(),
      latitude: coords ? String(coords.latitude) : null,
      longitude: coords ? String(coords.longitude) : null,
    });
    await firstValueFrom(this.api.post<unknown>('/PostManualEvacuation', dto));
  }

  async postRetail(input: RetailEvacuationInput): Promise<void> {
    const coords = await this.location.tryGetCurrent();
    const rawImage = this.signatureHelper.toRawBase64(input.imageBase64);
    const dto = await this.builder.build({
      action: ACTION.EVACUATION_RECEIPT,
      status: STATUS.OK,
      // Reuse bankid/branchid fields for retailer/retailer-branch IDs.
      // The legacy backend treats clientType=Retail via the same keys.
      bankid: input.retailerId,
      branchid: input.retailerBranchId,
      refnumber: input.refNumber ?? null,
      image: rawImage,
      note: input.note ?? null,
      routeid: this.day.routeId(),
      truckid: this.day.truckId(),
      latitude: coords ? String(coords.latitude) : null,
      longitude: coords ? String(coords.longitude) : null,
    });
    await firstValueFrom(this.api.post<unknown>('/PostEvacuationReceipt', dto));
  }
}
