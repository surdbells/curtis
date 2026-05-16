import { Injectable, signal } from '@angular/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';

const DB_NAME = 'curtis_local';
const DB_VERSION = 1;

/**
 * SQLite wrapper. Backs the offline request queue and the read-through
 * reference cache (banks, branches, trucks, seals manifest).
 *
 * Uses @capacitor-community/sqlite which runs natively on Android/iOS and
 * falls back to the sql.js / IndexedDB web store in the browser via the
 * <jeep-sqlite> custom element + sql-wasm.wasm asset.
 *
 * Init is defensive: if anything fails (wasm 404 during dev, missing
 * permission on a locked-down device, etc.) the service stays in an
 * `unavailable` state. Callers should check `available()` before using the
 * cache; OfflineQueueService and ReferenceCacheService already do.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private sqlite: SQLiteConnection | null = null;
  private db: SQLiteDBConnection | null = null;
  private readonly _available = signal(false);

  /** Reactive — true once SQLite is open and the schema is migrated. */
  readonly available = this._available.asReadonly();

  async init(): Promise<void> {
    if (this.db) return;

    try {
      this.sqlite = new SQLiteConnection(CapacitorSQLite);

      // On web, initialise the wasm jeep-sqlite store first.
      if (Capacitor.getPlatform() === 'web') {
        await customElements.whenDefined('jeep-sqlite').catch(() => undefined);
        await this.sqlite.initWebStore();
      }

      const isConn = (await this.sqlite.isConnection(DB_NAME, false)).result;
      this.db = isConn
        ? await this.sqlite.retrieveConnection(DB_NAME, false)
        : await this.sqlite.createConnection(DB_NAME, false, 'no-encryption', DB_VERSION, false);

      await this.db.open();
      await this.db.execute(SCHEMA_SQL);
      await this.migrateQueueColumns();
      this._available.set(true);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[StorageService] SQLite unavailable — offline features will degrade.', err);
      this.db = null;
      this.sqlite = null;
      this._available.set(false);
    }
  }

  /**
   * Idempotent column adds for the Phase 7 drain worker. SQLite has no
   * IF NOT EXISTS for ALTER TABLE ADD COLUMN, so we probe the schema and
   * add only what's missing.
   */
  private async migrateQueueColumns(): Promise<void> {
    if (!this.db) return;
    const info = await this.db.query('PRAGMA table_info(queued_requests)');
    const cols = (info.values ?? []).map((r) => String(r['name']));
    const stmts: string[] = [];
    if (!cols.includes('next_attempt_at')) {
      stmts.push("ALTER TABLE queued_requests ADD COLUMN next_attempt_at TEXT");
    }
    if (!cols.includes('status')) {
      // 'pending' (default) | 'dead_letter'
      stmts.push("ALTER TABLE queued_requests ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'");
    }
    for (const sql of stmts) {
      await this.db.execute(sql);
    }
    // Index on (status, next_attempt_at) for fast eligible-row scan.
    await this.db.execute(
      'CREATE INDEX IF NOT EXISTS idx_queued_requests_status_next ON queued_requests (status, next_attempt_at)',
    );
  }

  /** Returns the open DB connection or null if SQLite is unavailable. */
  getDb(): SQLiteDBConnection | null {
    return this.db;
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
    if (this.sqlite) {
      try {
        await this.sqlite.closeConnection(DB_NAME, false);
      } catch {
        // ignore
      }
      this.sqlite = null;
    }
  }
}

/**
 * Initial schema. Intentionally minimal in Phase 1 — tables grow per phase.
 */
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS queued_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  method TEXT NOT NULL,
  url TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_attempt_at TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  idempotency_key TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_queued_requests_created_at
  ON queued_requests (created_at);

-- Simple key/value store for cached JSON payloads (truck, route, etc.).
-- Phase 3 uses this for offline-resilient dashboard rendering.
CREATE TABLE IF NOT EXISTS reference_cache (
  cache_key TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  cached_at TEXT NOT NULL
);
`;
