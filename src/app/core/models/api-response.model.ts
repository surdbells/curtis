/**
 * Generic envelope returned by every TrackingApi endpoint.
 *
 * Per Phase 0 confirmation, all responses wrap their payload like:
 *   { "status": "0", "message": "...", "data": { ... } }
 *
 * `status === "0"` indicates success. Any other value (including absence)
 * indicates failure; `message` should be surfaced to the user or logs.
 *
 * NOTE: `status` is a STRING, not an HTTP status code. The HTTP response
 * itself may still be 200 even when `status !== "0"`.
 */
export interface ApiResponse<T> {
  status: string;
  message?: string;
  data?: T;
}

/** Convenience type-guard. */
export function isApiSuccess<T>(r: ApiResponse<T>): r is ApiResponse<T> & { data: T } {
  return r?.status === '0' && r.data !== undefined && r.data !== null;
}
