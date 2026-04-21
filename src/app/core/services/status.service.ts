import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { ActionBuilderService } from './action-builder.service';
import { LocationService } from './location.service';
import { ACTION, STATUS } from '../models';
import type { DevicePostDto } from '../models';

/**
 * Thin wrapper around POST /PostStatusByUserId.
 *
 * Used as the generic "something happened" beat that follows every
 * operational action (check-in, check-out, process, etc.). Feature code
 * will typically call beat() immediately after the action-specific POST
 * so backend has a unified audit stream.
 *
 * TODO(phase-0): confirm whether the beat is needed per-action or whether
 * the action endpoints themselves already write the audit. If it's the
 * latter, we can drop these calls and keep only the action POSTs.
 */
@Injectable({ providedIn: 'root' })
export class StatusService {
  private readonly api = inject(ApiService);
  private readonly builder = inject(ActionBuilderService);
  private readonly location = inject(LocationService);

  /**
   * Post a status beat. Pass any DevicePostDto fields you want recorded —
   * common fields (device, user, time, battery) are auto-populated.
   * If `includeCoords` is true (default), a best-effort coarse location
   * is attached.
   */
  async beat(
    overrides: Partial<DevicePostDto>,
    options: { includeCoords?: boolean } = {},
  ): Promise<void> {
    const includeCoords = options.includeCoords ?? true;
    const coords = includeCoords ? await this.location.tryGetCurrent() : null;

    const dto = await this.builder.build({
      action: ACTION.STATUS_BEAT,
      status: STATUS.OK,
      ...overrides,
      latitude: coords ? String(coords.latitude) : overrides.latitude ?? null,
      longitude: coords ? String(coords.longitude) : overrides.longitude ?? null,
    });

    await firstValueFrom(this.api.post<unknown>('/PostStatusByUserId', dto));
  }
}
