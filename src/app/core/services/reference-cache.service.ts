import { Injectable, inject } from '@angular/core';
import { StorageService } from './storage.service';
import { nowIsoUtc } from '../utils';

/**
 * Simple read-through JSON cache for reference data (truck, route, banks).
 * Backed by the `reference_cache` table in the local SQLite database.
 *
 * Used in Phase 3 so dashboard cold-starts are usable even when offline —
 * the last-known truck and route render immediately while a fresh fetch
 * runs in the background.
 */
@Injectable({ providedIn: 'root' })
export class ReferenceCacheService {
  private readonly storage = inject(StorageService);

  async get<T>(key: string): Promise<T | null> {
    try {
      const db = this.storage.getDb();
      if (!db) return null;
      const res = await db.query(
        'SELECT payload FROM reference_cache WHERE cache_key = ? LIMIT 1',
        [key],
      );
      const row = res.values?.[0];
      if (!row || typeof row['payload'] !== 'string') return null;
      return JSON.parse(row['payload']) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      const db = this.storage.getDb();
      if (!db) return;
      await db.run(
        `INSERT INTO reference_cache (cache_key, payload, cached_at)
         VALUES (?, ?, ?)
         ON CONFLICT(cache_key) DO UPDATE SET
           payload = excluded.payload,
           cached_at = excluded.cached_at`,
        [key, JSON.stringify(value), nowIsoUtc()],
      );
    } catch {
      // cache failures are non-fatal
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const db = this.storage.getDb();
      if (!db) return;
      await db.run('DELETE FROM reference_cache WHERE cache_key = ?', [key]);
    } catch {
      // ignore
    }
  }
}
