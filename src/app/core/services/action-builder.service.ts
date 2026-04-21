import { Injectable, inject } from '@angular/core';
import { DeviceService } from './device.service';
import { SessionStore } from '../stores/session.store';
import { nowIsoUtc } from '../utils';
import type { DevicePostDto } from '../models';

/**
 * Constructs DevicePostDto payloads with common fields pre-populated.
 *
 * Every POST on the TrackingApi uses D_DevicePostDto. The common fields
 * (deviceId, utcDateTime, userid, batterystatus) are identical across
 * actions — this builder centralises them so feature code only has to
 * specify the action-specific bits.
 *
 * Usage:
 *   const dto = await this.builder.build({
 *     action: 'start_day',
 *     truckid: '123',
 *     routeid: '456',
 *     mileage: '50000',
 *     gaslevel: '80',
 *     latitude: '6.5',
 *     longitude: '3.4',
 *   });
 *
 * Unspecified fields are left undefined (serialised as omitted). If a call
 * requires a field that the backend treats as required, that's a concern
 * for the feature code — this builder does not enforce per-action schemas.
 */
@Injectable({ providedIn: 'root' })
export class ActionBuilderService {
  private readonly device = inject(DeviceService);
  private readonly session = inject(SessionStore);

  /**
   * Build a DevicePostDto. Spread the overrides last so callers can override
   * any auto-filled field explicitly when needed.
   */
  async build(overrides: Partial<DevicePostDto> = {}): Promise<DevicePostDto> {
    const ctx = await this.device.getContext(true).catch(() => null);
    const userId = this.session.userId();

    const base: DevicePostDto = {
      deviceId: ctx?.deviceId ?? null,
      utcDateTime: nowIsoUtc(),
      userid: userId,
      batterystatus:
        ctx?.batteryLevel !== undefined ? String(ctx.batteryLevel) : null,
    };

    return { ...base, ...overrides };
  }
}
