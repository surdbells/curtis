import { Injectable, inject, signal, effect } from '@angular/core';
import { HttpBackend, HttpHeaders, HttpRequest } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { App, AppState } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import type { PluginListenerHandle } from '@capacitor/core';

import { StorageService } from './storage.service';
import { ConnectivityService } from './connectivity.service';
import { ConfigService } from './config.service';
import { nowIsoUtc } from '../utils';
import type { QueuedRequest } from '../models';

const TIMER_INTERVAL_MS = 60_000;
const BACKOFF_STEPS_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 60_000];
const MAX_RETRIES = 10;
const BATCH_SIZE = 20;
const TOKEN_KEY = 'curtis.auth.access'; // Must match KEY_ACCESS in token.service.ts

/**
 * Persists failed POSTs to SQLite and replays them with exponential backoff.
 *
 * Triggers (Phase 7 decisions):
 *   - Network reconnect (effect on ConnectivityService.online signal)
 *   - App resume (Capacitor App appStateChange -> isActive)
 *   - Periodic timer every 60s while online
 *
 * Replay ordering: skip-failed-continue. Each row carries its own
 * next_attempt_at; the worker queries for rows where
 *   status='pending' AND (next_attempt_at IS NULL OR next_attempt_at <= now)
 * ordered by created_at ASC. A failure on one row updates that row's
 * next_attempt_at via exponential backoff and the worker moves on —
 * later rows are not blocked.
 *
 * Backoff: 1s, 2s, 4s, 8s, 16s, 32s, 60s, 60s, 60s, 60s — exactly 10 retries.
 * On the 11th failure the row is moved to status='dead_letter' and the
 * worker skips it forever; the Queue page surfaces it for manual
 * retry/discard.
 *
 * Interceptor bypass: replays use HttpBackend directly, bypassing the
 * full interceptor chain. Otherwise a network error on replay would
 * re-enqueue the same row — an infinite duplication loop. This means
 * replays do not get the auto-JWT-attachment from jwt.interceptor;
 * Authorization is added manually in this service.
 */
@Injectable({ providedIn: 'root' })
export class OfflineQueueService {
  private readonly backend = inject(HttpBackend);
  private readonly storage = inject(StorageService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly config = inject(ConfigService);

  /** Total rows: pending + dead-letter. Used by offline banner badge. */
  readonly pendingCount = signal<number>(0);
  /** Subset of total: dead-letter rows only. Surfaced separately in UI. */
  readonly deadLetterCount = signal<number>(0);
  /** True while a drain() call is in progress. Prevents re-entrant work. */
  readonly draining = signal<boolean>(false);

  /** Single in-flight promise so concurrent drain triggers coalesce. */
  private drainPromise: Promise<void> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private appListener?: PluginListenerHandle;

  constructor() {
    // React to network changes — fire drain on reconnect.
    effect(() => {
      const online = this.connectivity.online();
      if (online) {
        void this.drain().catch(() => undefined);
      }
    });
  }

  /**
   * Wire up the trigger listeners. Called once from the app initialiser
   * after StorageService.init.
   */
  async start(): Promise<void> {
    await this.refreshCount();

    // Periodic timer.
    if (!this.timer) {
      this.timer = setInterval(() => {
        if (this.connectivity.online()) void this.drain().catch(() => undefined);
      }, TIMER_INTERVAL_MS);
    }

    // App resume — Capacitor App plugin emits appStateChange.
    if (Capacitor.isNativePlatform() && !this.appListener) {
      this.appListener = await App.addListener('appStateChange', (state: AppState) => {
        if (state.isActive && this.connectivity.online()) {
          void this.drain().catch(() => undefined);
        }
      });
    }

    // Kick once at startup in case rows are eligible already.
    if (this.connectivity.online()) {
      void this.drain().catch(() => undefined);
    }
  }

  /** For tests / shutdown — stop trigger sources. */
  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.appListener) {
      try { await this.appListener.remove(); } catch { /* ignore */ }
      this.appListener = undefined;
    }
  }

  /** Persist a failed POST for later replay. Called by offline.interceptor. */
  async enqueue(args: { url: string; body: unknown }): Promise<QueuedRequest> {
    const now = nowIsoUtc();
    const row: QueuedRequest = {
      method: 'POST',
      url: args.url,
      body: JSON.stringify(args.body ?? {}),
      createdAt: now,
      retryCount: 0,
      idempotencyKey: uuid(),
      status: 'pending',
    };

    const db = this.storage.getDb();
    if (!db) {
      throw new Error('Offline queue unavailable: SQLite not initialised');
    }
    await db.run(
      `INSERT INTO queued_requests
         (method, url, body, created_at, retry_count, idempotency_key, status, next_attempt_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', NULL)`,
      [row.method, row.url, row.body, row.createdAt, row.retryCount, row.idempotencyKey],
    );

    await this.refreshCount();
    return row;
  }

  /** Read total pending + dead-letter counts into the reactive signals. */
  async refreshCount(): Promise<number> {
    const db = this.storage.getDb();
    if (!db) {
      this.pendingCount.set(0);
      this.deadLetterCount.set(0);
      return 0;
    }
    const res = await db.query(
      "SELECT status, COUNT(*) AS c FROM queued_requests GROUP BY status",
    );
    let pending = 0;
    let dead = 0;
    for (const r of res.values ?? []) {
      const c = (r['c'] as number | undefined) ?? 0;
      if (r['status'] === 'dead_letter') dead = c;
      else pending = c;
    }
    this.pendingCount.set(pending);
    this.deadLetterCount.set(dead);
    return pending + dead;
  }

  /**
   * Drain eligible queued rows. Coalesces concurrent calls — the first
   * caller does the work, subsequent callers await the same promise.
   */
  async drain(): Promise<void> {
    if (this.drainPromise) return this.drainPromise;
    if (!this.connectivity.online()) return;
    const db = this.storage.getDb();
    if (!db) return;

    this.drainPromise = (async () => {
      this.draining.set(true);
      try {
        await this.runDrainLoop();
      } finally {
        this.draining.set(false);
        this.drainPromise = null;
        await this.refreshCount();
      }
    })();
    return this.drainPromise;
  }

  /**
   * List all queued rows for the Queue inspection page (Phase 7 Commit 2).
   * Newest pending first; dead-letter rows after.
   */
  async list(): Promise<QueuedRequest[]> {
    const db = this.storage.getDb();
    if (!db) return [];
    const res = await db.query(
      `SELECT id, method, url, body, created_at, last_attempt_at, next_attempt_at,
              retry_count, last_error, idempotency_key, status
       FROM queued_requests
       ORDER BY (status = 'dead_letter') ASC, created_at DESC`,
    );
    return (res.values ?? []).map(this.rowToRequest);
  }

  /**
   * Force an immediate retry of a dead-letter row by resetting its
   * retry_count and status. The next drain() will pick it up.
   */
  async retryRow(id: number): Promise<void> {
    const db = this.storage.getDb();
    if (!db) return;
    await db.run(
      `UPDATE queued_requests
       SET status = 'pending', retry_count = 0, next_attempt_at = NULL, last_error = NULL
       WHERE id = ?`,
      [id],
    );
    await this.refreshCount();
    void this.drain().catch(() => undefined);
  }

  /** Permanently delete a queued row. Used by the Queue page. */
  async discardRow(id: number): Promise<void> {
    const db = this.storage.getDb();
    if (!db) return;
    await db.run('DELETE FROM queued_requests WHERE id = ?', [id]);
    await this.refreshCount();
  }

  /** Permanently delete every row. Used by the Queue page "Clear all". */
  async clearAll(): Promise<void> {
    const db = this.storage.getDb();
    if (!db) return;
    await db.run('DELETE FROM queued_requests');
    await this.refreshCount();
  }

  // ---------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------

  private async runDrainLoop(): Promise<void> {
    const db = this.storage.getDb();
    if (!db) return;
    const now = nowIsoUtc();

    // Eligible rows: status='pending' AND (next_attempt_at IS NULL OR <= now)
    const res = await db.query(
      `SELECT id, method, url, body, created_at, last_attempt_at, next_attempt_at,
              retry_count, last_error, idempotency_key, status
       FROM queued_requests
       WHERE status = 'pending' AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
       ORDER BY created_at ASC
       LIMIT ?`,
      [now, BATCH_SIZE],
    );

    const rows = (res.values ?? []).map(this.rowToRequest);

    for (const row of rows) {
      if (!this.connectivity.online()) break;       // network dropped mid-drain
      if (!row.id) continue;
      try {
        await this.replay(row);
        await db.run('DELETE FROM queued_requests WHERE id = ?', [row.id]);
      } catch (err) {
        await this.handleFailure(row, err);
      }
    }
  }

  /**
   * Replay a single queued row using HttpBackend (bypasses the
   * interceptor chain to avoid recursive enqueue on failure).
   *
   * Adds Authorization header from the current session token if available.
   * If the row's body parses as JSON, content type is set to application/json.
   */
  private async replay(row: QueuedRequest): Promise<void> {
    const baseUrl = this.config.apiBaseUrl;
    const fullUrl = row.url.startsWith('http')
      ? row.url
      : `${baseUrl}${row.url.startsWith('/') ? '' : '/'}${row.url}`;

    let parsedBody: unknown;
    try { parsedBody = JSON.parse(row.body); }
    catch { parsedBody = row.body; }

    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'X-Idempotency-Key': row.idempotencyKey,
      'X-Queued-At': row.createdAt,
    });

    const token = await this.readPersistedToken();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    const req = new HttpRequest('POST', fullUrl, parsedBody, { headers });
    await firstValueFrom(this.backend.handle(req));
  }

  /** Read the current session JWT from @capacitor/preferences. */
  private async readPersistedToken(): Promise<string | null> {
    try {
      const { value } = await Preferences.get({ key: TOKEN_KEY });
      return value ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Record a failed replay attempt: bump retry_count, compute next_attempt_at
   * via the backoff schedule, and dead-letter once MAX_RETRIES is reached.
   */
  private async handleFailure(row: QueuedRequest, err: unknown): Promise<void> {
    const db = this.storage.getDb();
    if (!db || !row.id) return;
    const newCount = (row.retryCount ?? 0) + 1;
    const errText = this.describeError(err).slice(0, 240);
    const now = nowIsoUtc();

    if (newCount >= MAX_RETRIES) {
      await db.run(
        `UPDATE queued_requests
         SET retry_count = ?, last_attempt_at = ?, last_error = ?,
             next_attempt_at = NULL, status = 'dead_letter'
         WHERE id = ?`,
        [newCount, now, errText, row.id],
      );
    } else {
      const backoffMs = BACKOFF_STEPS_MS[Math.min(newCount - 1, BACKOFF_STEPS_MS.length - 1)];
      const nextAt = new Date(Date.now() + backoffMs).toISOString();
      await db.run(
        `UPDATE queued_requests
         SET retry_count = ?, last_attempt_at = ?, last_error = ?, next_attempt_at = ?
         WHERE id = ?`,
        [newCount, now, errText, nextAt, row.id],
      );
    }
  }

  private describeError(err: unknown): string {
    if (!err) return 'Unknown error';
    if (typeof err === 'string') return err;
    const e = err as { status?: number; message?: string; statusText?: string };
    if (typeof e.status === 'number') {
      return `HTTP ${e.status}${e.statusText ? ' ' + e.statusText : ''}`;
    }
    return e.message ?? 'Unknown error';
  }

  /** Map a raw SQLite row to a typed QueuedRequest. Arrow fn to preserve `this` in .map(). */
  private rowToRequest = (r: Record<string, unknown>): QueuedRequest => ({
    id: r['id'] as number,
    method: 'POST',
    url: String(r['url']),
    body: String(r['body']),
    createdAt: String(r['created_at']),
    lastAttemptAt: (r['last_attempt_at'] as string | null) ?? undefined,
    nextAttemptAt: (r['next_attempt_at'] as string | null) ?? undefined,
    retryCount: (r['retry_count'] as number | undefined) ?? 0,
    lastError: (r['last_error'] as string | null) ?? undefined,
    idempotencyKey: String(r['idempotency_key']),
    status: (r['status'] as 'pending' | 'dead_letter' | null) ?? 'pending',
  });
}
