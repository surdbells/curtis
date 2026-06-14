import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { ActionBuilderService } from './action-builder.service';
import { ACTION, STATUS } from '../models';
import type { DevicePostDto } from '../models';

/**
 * Thin wrapper around POST /PostStatusByUserId.
 *
 * Used as the generic "something happened" beat that follows every
 * operational action. lat/long auto-fill via the canonical builder reads
 * from LocationGate, so callers no longer need to opt in or out.
 */
@Injectable({ providedIn: 'root' })
export class StatusService {
  private readonly api = inject(ApiService);
  private readonly builder = inject(ActionBuilderService);

  /**
   * Post a status beat. Pass any DevicePostDto fields you want recorded —
   * common fields (device, user, time, battery, latitude, longitude) are
   * auto-populated.
   */
  async beat(overrides: Partial<DevicePostDto>): Promise<void> {
    const dto = await this.builder.build({
      action: ACTION.STATUS_BEAT,
      status: STATUS.OK,
      ...overrides,
    });

    await firstValueFrom(this.api.post<unknown>('/PostStatusByUserId', dto));
  }
}
