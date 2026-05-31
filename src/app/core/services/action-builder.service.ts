import { Injectable, inject } from '@angular/core';
import { DeviceService } from './device.service';
import { SessionStore } from '../stores/session.store';
import { formatLegacyDateTime, nowIsoUtc } from '../utils';
import type { DevicePostDto } from '../models';

/**
 * Maps the human-friendly DevicePostDto field names to the field names the
 * legacy CurtisTracker backend actually accepts.
 *
 * The OpenAPI 3.1 schema used snake_case (`utcDateTime`, `batterystatus`)
 * but the legacy Android client posts with `DateTime`, `batterylevel`, etc.
 * — and that's what the production server's accept-list still expects.
 * Source: legacy/CurtisTracker BankActivity.java, ProcessActivity.java,
 * ManualActivity.java field constants.
 *
 * Keys that don't appear here pass through unchanged.
 */
const WIRE_FIELD_NAMES: Record<string, string> = {
  utcDateTime: 'DateTime',
  batterystatus: 'batterylevel',
};

/**
 * Constructs DevicePostDto payloads with common fields pre-populated.
 *
 * Every POST on the TrackingApi uses D_DevicePostDto. The common fields
 * (deviceId, utcDateTime, userid, batterystatus) are identical across
 * actions — this builder centralises them so feature code only has to
 * specify the action-specific bits.
 *
 * The returned object is keyed with the WIRE names (i.e. what the legacy
 * backend expects), not the TypeScript names. Callers serialise the
 * returned dict directly without further transformation.
 *
 * Wire boundary value conversions:
 *   - `utcDateTime` (ISO 8601 internally) is converted to the legacy
 *     `dd/MM/yyyy hh:mm tt` format the backend expects. Internal callers
 *     keep using ISO; this builder is the only place that knows about
 *     the wire format.
 */
@Injectable({ providedIn: 'root' })
export class ActionBuilderService {
  private readonly device = inject(DeviceService);
  private readonly session = inject(SessionStore);

  /**
   * Build a DevicePostDto. Spread the overrides last so callers can override
   * any auto-filled field explicitly when needed.
   *
   * @returns a plain object suitable for HttpClient.post — field keys
   *          have been translated to the legacy backend's wire format,
   *          and `utcDateTime` has been reformatted from ISO 8601 to
   *          the legacy `dd/MM/yyyy hh:mm tt` format.
   */
  async build(overrides: Partial<DevicePostDto> = {}): Promise<Record<string, string | null | undefined>> {
    const ctx = await this.device.getContext(true).catch(() => null);
    const userId = this.session.userId();

    const base: DevicePostDto = {
      deviceId: ctx?.deviceId ?? null,
      utcDateTime: nowIsoUtc(),
      userid: userId,
      batterystatus:
        ctx?.batteryLevel !== undefined ? String(ctx.batteryLevel) : null,
    };

    const merged: Partial<DevicePostDto> = { ...base, ...overrides };

    // Convert utcDateTime (ISO 8601) to the format the backend expects.
    // Backend error if this isn't done:
    //   "Unable to convert  to a date and time. accepted format is
    //    dd/MM/yyyy hh:mm tt example 16/09/2017 06:55 PM"
    // The conversion uses device-local time (no timezone in the target
    // format). Lagos = UTC+1 with no DST; behaves as expected.
    if (merged.utcDateTime) {
      const parsed = new Date(merged.utcDateTime);
      if (!Number.isNaN(parsed.getTime())) {
        merged.utcDateTime = formatLegacyDateTime(parsed);
      }
    }

    return this.toWireFormat(merged);
  }

  /**
   * Translate TypeScript field names to the legacy backend's wire field
   * names. Undefined keys are dropped; null is preserved so the server can
   * see an explicit null.
   */
  private toWireFormat(dto: Partial<DevicePostDto>): Record<string, string | null | undefined> {
    const out: Record<string, string | null | undefined> = {};
    for (const [k, v] of Object.entries(dto)) {
      if (v === undefined) continue;
      const wireKey = WIRE_FIELD_NAMES[k] ?? k;
      out[wireKey] = v as string | null;
    }
    return out;
  }
}
