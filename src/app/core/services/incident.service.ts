import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { ActionBuilderService } from './action-builder.service';
import { LocationService } from './location.service';
import { SignatureService } from './signature.service';
import { DayStore } from '../stores/day.store';
import { ACTION, STATUS } from '../models';
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
 *   latitude/longitude = current device location
 *
 * Location is collected synchronously before the POST — if the agent is
 * indoors with no fix, we use the last known fix from TrackerService
 * (Phase 6 Commit 1). All three required fields are validated by the
 * caller (the Incident page); this service trusts its inputs.
 *
 * Failure handling: if the network is down, the offline interceptor
 * enqueues the request to SQLite for replay. The caller's `await` will
 * resolve once the POST has been accepted by the offline layer or the
 * network — either way the agent gets to feedback toast quickly.
 */
@Injectable({ providedIn: 'root' })
export class IncidentService {
  private readonly api = inject(ApiService);
  private readonly builder = inject(ActionBuilderService);
  private readonly location = inject(LocationService);
  private readonly signatureHelper = inject(SignatureService);
  private readonly day = inject(DayStore);

  async report(input: IncidentInput): Promise<void> {
    const coords = await this.location.tryGetCurrent();
    const rawImage = this.signatureHelper.toRawBase64(input.imageBase64);

    const dto = await this.builder.build({
      action: ACTION.INCIDENT,
      status: input.severity,          // backend uses status field for severity
      incidentytype: input.typeId,
      note: input.note,
      image: rawImage,
      routeid: this.day.routeId(),
      truckid: this.day.truckId(),
      latitude: coords ? String(coords.latitude) : null,
      longitude: coords ? String(coords.longitude) : null,
    });

    await firstValueFrom(this.api.post<unknown>('/PostStatusByUserId', dto));
  }
}
