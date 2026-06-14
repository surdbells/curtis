import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { ActionBuilderService } from './action-builder.service';
import { LocationGateService } from './location-gate.service';
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
 * latitude/longitude come from the canonical builder via LocationGate —
 * no per-call fetch needed.
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
  private readonly locationGate = inject(LocationGateService);
  private readonly signatureHelper = inject(SignatureService);

  async postManual(input: ManualEvacuationInput): Promise<void> {
    await this.ensureCoords('Location required to submit a manual evacuation.');
    const dto = await this.builder.build({
      originationid: input.bankId,
      originationbranchid: input.branchId,
      destinationbankid: input.destinationBankId ?? null,
      destinationbranchid: input.destinationBranchId ?? null,
      proctype: input.procType ?? null,
      seals: input.sealIds.filter(Boolean).join(','),
      note: input.note ?? null,
    });
    await firstValueFrom(this.api.post<unknown>('/PostManualEvacuation', dto));
  }

  async postRetail(input: RetailEvacuationInput): Promise<void> {
    await this.ensureCoords('Location required to submit a retail evacuation.');
    const rawImage = this.signatureHelper.toRawBase64(input.imageBase64);
    const dto = await this.builder.build({
      action: ACTION.EVACUATION_RECEIPT,
      bankid: input.retailerId,
      branchid: input.retailerBranchId,
      refnumber: input.refNumber ?? null,
      image: rawImage,
      note: input.note ?? null,
    });
    await firstValueFrom(this.api.post<unknown>('/PostEvacuationReceipt', dto));
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
