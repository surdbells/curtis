import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { ActionBuilderService } from './action-builder.service';
import { LocationService } from './location.service';
import { SignatureService } from './signature.service';
import { ACTION } from '../models';

export interface ManualEvacuationInput {
  /** Originating bank. Wire field: `originationid`. */
  bankId: string;
  /** Originating branch. Wire field: `originationbranchid`. */
  branchId: string;
  /** Destination bank. Optional. Wire field: `destinationbankid`. */
  destinationBankId?: string;
  /** Destination branch. Optional. Wire field: `destinationbranchid`. */
  destinationBranchId?: string;
  /** User-entered processing type. Wire field: `proctype`. */
  procType?: string;
  sealIds: string[];
  /** Optional note entered by the agent. */
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
 * Field mappings derived from legacy CurtisTracker ManualActivity:
 *   BANK_ID         = "originationid"          (origin bank)
 *   BRANCH_ID       = "originationbranchid"    (origin branch)
 *   DES_ID          = "destinationbankid"      (destination bank)
 *   DES_BR_ID       = "destinationbranchid"    (destination branch)
 *   PROCESS_TYPE    = "proctype"               (processing type)
 *   SEALS           = "seals"                  (comma-separated)
 *
 * Legacy ManualActivity does NOT include `action`, `status`, `routeid`,
 * `truckid`, or `note` on the manual-evacuation POST. We follow that
 * shape — those fields are left at the canonical "" default produced
 * by ActionBuilderService. `note` is the one intentional improvement
 * (keeps the agent's note for the audit trail; backend treats unknown
 * extra fields as harmless).
 */
@Injectable({ providedIn: 'root' })
export class EvacuationService {
  private readonly api = inject(ApiService);
  private readonly builder = inject(ActionBuilderService);
  private readonly location = inject(LocationService);
  private readonly signatureHelper = inject(SignatureService);

  async postManual(input: ManualEvacuationInput): Promise<void> {
    const coords = await this.location.tryGetCurrent();
    const dto = await this.builder.build({
      // Origin (legacy: BANK_ID="originationid", BRANCH_ID="originationbranchid")
      originationid: input.bankId,
      originationbranchid: input.branchId,
      // Destination (legacy: hardcoded ""; we accept user input where given)
      destinationbankid: input.destinationBankId ?? null,
      destinationbranchid: input.destinationBranchId ?? null,
      // Processing type (legacy: PROCESS_TYPE="proctype")
      proctype: input.procType ?? null,
      // Comma-joined seal IDs (legacy: SEALS="seals", same convention)
      seals: input.sealIds.filter(Boolean).join(','),
      // Optional note (improvement over legacy; kept for audit trail)
      note: input.note ?? null,
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
      // Reuse bankid/branchid fields for retailer/retailer-branch IDs.
      // The legacy backend treats clientType=Retail via the same keys.
      bankid: input.retailerId,
      branchid: input.retailerBranchId,
      refnumber: input.refNumber ?? null,
      image: rawImage,
      note: input.note ?? null,
      latitude: coords ? String(coords.latitude) : null,
      longitude: coords ? String(coords.longitude) : null,
    });
    await firstValueFrom(this.api.post<unknown>('/PostEvacuationReceipt', dto));
  }
}
