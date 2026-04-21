/**
 * D_DevicePostDto — the single request body shape used by almost every
 * POST endpoint on the TrackingApi.
 *
 * Per the OpenAPI spec every field is `string | null`. In practice each
 * endpoint consumes a specific subset; see action-builder helpers (Phase 3+)
 * for the per-endpoint required field sets.
 *
 * Fields are kept in the same order as the OpenAPI schema for easy diffing.
 */
export interface DevicePostDto {
  deviceId?: string | null;
  /** ISO 8601 UTC. Example: "2026-04-21T08:15:00.000Z". */
  utcDateTime?: string | null;
  note?: string | null;
  /** Verb for this post (e.g. "check_in", "start_day"). Per-endpoint values TBC in Phase 3. */
  action?: string | null;
  /** Post-action state (e.g. "ok", "incident"). Per-endpoint values TBC in Phase 3. */
  status?: string | null;

  bankid?: string | null;
  branchid?: string | null;
  batchid?: string | null;

  originationid?: string | null;
  originationbranchid?: string | null;
  destinationbankid?: string | null;
  destinationbranchid?: string | null;

  processingtype?: string | null;
  proctype?: string | null;

  /**
   * User GUID. Decoded from JWT `sub` and included client-side on every POST.
   * Phase 0 default — may be made server-derived later; harmless to send either way.
   */
  userid?: string | null;

  refnumber?: string | null;

  longitude?: string | null;
  latitude?: string | null;
  mileage?: string | null;
  gaslevel?: string | null;

  truckid?: string | null;
  routeid?: string | null;

  /** Signature as base64 PNG (TBC in Phase 4). */
  signature?: string | null;
  /**
   * Seals payload. Format TBC in Phase 5 — likely comma-separated IDs or
   * a JSON-encoded array. We'll standardise on one format when backend confirms.
   */
  seals?: string | null;

  email?: string | null;
  phone?: string | null;

  vaultid?: string | null;
  xmlresponse?: string | null;
  batterystatus?: string | null;
  incidentytype?: string | null;

  /** Photo as base64 JPEG (TBC in Phase 5). */
  image?: string | null;
  vaultstatus?: string | null;
}
