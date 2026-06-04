import { Injectable, inject } from '@angular/core';
import { DeviceService } from './device.service';
import { SessionStore } from '../stores/session.store';
import { nowIsoUtc } from '../utils';
import type { DevicePostDto } from '../models';

/**
 * The full set of canonical DevicePostDto field names the backend expects
 * on every POST. Every key appears in every wire payload — fields not
 * supplied by the caller get explicit `null` so the backend always sees
 * the same shape.
 *
 * Order matches `D_DevicePostDto` in the API model file for easy diffing.
 */
const CANONICAL_FIELDS: readonly (keyof DevicePostDto)[] = [
  'deviceId',
  'utcDateTime',
  'note',
  'action',
  'status',
  'bankid',
  'branchid',
  'batchid',
  'originationid',
  'originationbranchid',
  'destinationbankid',
  'destinationbranchid',
  'processingtype',
  'proctype',
  'userid',
  'refnumber',
  'longitude',
  'latitude',
  'mileage',
  'gaslevel',
  'truckid',
  'routeid',
  'signature',
  'seals',
  'email',
  'phone',
  'vaultid',
  'xmlresponse',
  'batterystatus',
  'incidentytype',
  'image',
  'vaultstatus',
] as const;

/**
 * Constructs DevicePostDto payloads with common fields pre-populated.
 *
 * Every POST on the TrackingApi uses D_DevicePostDto. The common fields
 * (deviceId, utcDateTime, userid, batterystatus) are identical across
 * actions — this builder centralises them so feature code only has to
 * specify the action-specific bits.
 *
 * Canonical-shape guarantee
 * =========================
 * The returned object ALWAYS contains every CANONICAL_FIELDS key. Fields
 * not supplied by the caller (and not auto-filled here) are set to the
 * empty string `""`. This is required by the backend: every endpoint
 * expects to receive the full DTO shape on the wire with `""` for unset
 * fields (no `null`s).
 *
 * Date handling
 * =============
 *   `utcDateTime` is sent as ISO 8601 UTC (e.g. `2026-06-04T17:30:45.123Z`)
 *   per the canonical backend spec.
 */
@Injectable({ providedIn: 'root' })
export class ActionBuilderService {
  private readonly device = inject(DeviceService);
  private readonly session = inject(SessionStore);

  /**
   * Build a DevicePostDto. Spread the overrides last so callers can override
   * any auto-filled field explicitly when needed.
   *
   * @returns a plain object suitable for HttpClient.post — every canonical
   *          field is present, with `""` for fields the caller did not
   *          set. Caller `null` overrides are normalised to `""`.
   *          Caller `undefined` overrides leave the prior value in place.
   *          `utcDateTime` is in ISO 8601 UTC.
   */
  async build(overrides: Partial<DevicePostDto> = {}): Promise<Record<string, string>> {
    const ctx = await this.device.getContext(true).catch(() => null);
    const userId = this.session.userId();

    const autoFilled: Record<string, string> = {
      deviceId: ctx?.deviceId ?? '',
      utcDateTime: nowIsoUtc(),
      userid: userId ?? '',
      batterystatus:
        ctx?.batteryLevel !== undefined ? String(ctx.batteryLevel) : '',
    };

    // Start with every canonical field set to "", then layer auto-fills,
    // then caller overrides on top. This guarantees every wire payload
    // contains exactly the canonical key set in a stable order, with no
    // `null` values anywhere — only strings (possibly empty).
    const out: Record<string, string> = {};
    for (const key of CANONICAL_FIELDS) {
      out[key] = '';
    }
    for (const [k, v] of Object.entries(autoFilled)) {
      out[k] = v;
    }
    for (const [k, v] of Object.entries(overrides)) {
      // `undefined` overrides leave the default / auto-filled value in
      // place. `null` overrides normalise to "". Strings (including empty
      // strings) pass through unchanged.
      if (v === undefined) continue;
      out[k] = v === null ? '' : String(v);
    }
    return out;
  }
}
