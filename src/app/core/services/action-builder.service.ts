import { Injectable, inject } from '@angular/core';
import { DeviceService } from './device.service';
import { SessionStore } from '../stores/session.store';
import { nowIsoUtc } from '../utils';
import type { DevicePostDto } from '../models';

/**
 * Maps the human-friendly DevicePostDto field names to the field names the
 * backend actually accepts.
 *
 * Historical context: the original legacy server used `.NET`-style names
 * (`DateTime`, `batterylevel`). The modern backend spec uses `utcDateTime`
 * directly, so we no longer rename it. `batterystatus -> batterylevel` is
 * still translated for now (existing wire shape; not in the canonical spec
 * but accepted as harmless extra data).
 *
 * Keys that don't appear here pass through unchanged.
 */
const WIRE_FIELD_NAMES: Record<string, string> = {
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
 * Date handling:
 *   `utcDateTime` is sent as ISO 8601 UTC (e.g. `2026-06-04T17:30:45.123Z`)
 *   per the canonical backend spec. The older `dd/MM/yyyy hh:mm tt` wire
 *   format used by the original legacy server is no longer applied — the
 *   modern backend handles ISO 8601 directly.
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
   *          have been translated to the legacy backend's wire format.
   *          `utcDateTime` is in ISO 8601 UTC.
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
