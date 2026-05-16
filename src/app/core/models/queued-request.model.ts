/**
 * A request that failed to reach the server (offline or network error)
 * and has been persisted locally for later replay by offline-queue.service.
 *
 * Populated by offline.interceptor, drained by the Phase 7 worker on
 * reconnect / app-resume / 60s timer.
 */
export interface QueuedRequest {
  /** Local primary key (auto-increment in SQLite). */
  id?: number;

  /** HTTP method — GETs are not queued, so this will typically be POST. */
  method: 'POST';

  /** Full URL (base + path). */
  url: string;

  /** JSON-serialised request body. */
  body: string;

  /** ISO 8601 UTC timestamp when the request was first attempted. */
  createdAt: string;

  /** ISO 8601 UTC timestamp of the last retry attempt. */
  lastAttemptAt?: string;

  /**
   * ISO 8601 UTC timestamp at which the next retry becomes eligible.
   * Set by the drain worker after each failed attempt; ahead of this
   * time the worker skips the row to honour the backoff schedule.
   * Null/undefined = eligible immediately (newly enqueued rows).
   */
  nextAttemptAt?: string;

  /** Number of times replay has been attempted. */
  retryCount: number;

  /** Short error reason from the most recent failed attempt. */
  lastError?: string;

  /**
   * Idempotency key so the backend can safely dedupe replays.
   * Generated via uuid v4 at enqueue time and stored until success.
   */
  idempotencyKey: string;

  /**
   * Row lifecycle status.
   *   'pending'      — the worker will attempt replay (default)
   *   'dead_letter'  — exceeded the max retry count; worker ignores it.
   *                    Surfaced in the Queue page for manual retry/discard.
   */
  status?: 'pending' | 'dead_letter';
}
