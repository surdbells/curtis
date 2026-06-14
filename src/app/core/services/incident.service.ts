import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { ActionBuilderService } from './action-builder.service';
import { LocationGateService } from './location-gate.service';
import { SignatureService } from './signature.service';
import { DayStore } from '../stores/day.store';
import { ACTION } from '../models';
import type { IncidentSeverity } from '../models';

export interface IncidentInput {
  /** Incident type id, e.g. 'robbery' / 'mechanical'. */
  typeId: string;
  /** Severity level. Sent in DevicePostDto.status. */
  severity: IncidentSeverity;
  /** Free-text description. Required per Phase 6 decision. */
  note: string;
  /** Base64 JPEG of the incident photo. Required per Phase 6 decision. */
  imageBase64: string;
}

/**
 * Incident reporting service.
 *
 * The TrackingApi does not expose a dedicated incident endpoint. Per the
 * legacy CurtisTracker convention, incidents are reported via the generic
 * /PostStatusByUserId beat with:
 *   action          = 'incident'
 *   incidentytype   = type id (e.g. 'robbery')
 *   status          = severity ('low' | 'medium' | 'high' | 'critical')
 *   note            = description
 *   image           = base64 JPEG
 *   latitude/longitude = LocationGate cache (auto-fill on every POST)
 */
@Injectable({ providedIn: 'root' })
export class IncidentService {
  private readonly api = inject(ApiService);
  private readonly builder = inject(ActionBuilderService);
  private readonly locationGate = inject(LocationGateService);
  private readonly signatureHelper = inject(SignatureService);
  private readonly day = inject(DayStore);

  async report(input: IncidentInput): Promise<void> {
    // For incidents we don't BLOCK on missing coords — a robbery in progress
    // can't wait for GPS. Trigger a refresh but proceed either way; the
    // canonical builder fills "" if no fix is available.
    await this.locationGate.refresh();
    const rawImage = this.signatureHelper.toRawBase64(input.imageBase64);

    const dto = await this.builder.build({
      action: ACTION.INCIDENT,
      status: input.severity,
      incidentytype: input.typeId,
      note: input.note,
      image: rawImage,
      routeid: this.day.routeId(),
      truckid: this.day.truckId(),
    });

    await firstValueFrom(this.api.post<unknown>('/PostStatusByUserId', dto));
  }
}
