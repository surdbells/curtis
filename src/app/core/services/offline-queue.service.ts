import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';
import { ConnectivityService } from './connectivity.service';
import { ConfigService } from './config.service';
import { nowIsoUtc } from '../utils';
import { v4 as uuid } from 'uuid';
import type { QueuedRequest } from '../models';

/**
 * Persists failed POSTs to SQLite and replays them on reconnect.
 *
 * Phase 1 ships the enqueue API and pending-count signal. The replay loop,
 * exponential backoff, and idempotency handshake with the backend are
 * implemented in Phase 7.
 */
@Injectable({ providedIn: 'root' })
export class OfflineQueueService {
  private readonly storage = inject(StorageService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly config = inject(ConfigService);

  readonly pendingCount = signal<number>(0);

  /** Persist a failed POST for later replay. */
  async enqueue(args: { url: string; body: unknown }): Promise<QueuedRequest> {
    const now = nowIsoUtc();
    const row: QueuedRequest = {
      method: 'POST',
      url: args.url,
      body: JSON.stringify(args.body ?? {}),
      createdAt: now,
      retryCount: 0,
      idempotencyKey: uuid(),
    };

    const db = this.storage.getDb();
    if (!db) {
      // SQLite unavailable — surface as a rejection so the offline
      // interceptor can decide whether to swallow or report.
      throw new Error('Offline queue unavailable: SQLite not initialised');
    }
    await db.run(
      `INSERT INTO queued_requests
         (method, url, body, created_at, retry_count, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [row.method, row.url, row.body, row.createdAt, row.retryCount, row.idempotencyKey],
    );

    await this.refreshCount();
    return row;
  }

  /** Read the current count of pending requests into the signal. */
  async refreshCount(): Promise<number> {
    const db = this.storage.getDb();
    if (!db) {
      this.pendingCount.set(0);
      return 0;
    }
    const res = await db.query('SELECT COUNT(*) AS c FROM queued_requests');
    const c = (res.values?.[0]?.['c'] as number | undefined) ?? 0;
    this.pendingCount.set(c);
    return c;
  }

  /**
   * TODO(phase-7): drain the queue. Loop over rows, fire each as POST,
   * on 2xx delete the row, on failure increment retry_count (cap at
   * config.offlineQueueMaxRetries) with exponential backoff.
   */
  async drain(): Promise<void> {
    if (!this.connectivity.online()) return;
    // Implementation deferred to Phase 7.
  }
}
