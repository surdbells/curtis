import { Injectable } from '@angular/core';
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
 * falls back to the sql.js / IndexedDB web store in the browser.
 *
 * TODO(phase-7): finalise schema for cached reference tables.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private sqlite: SQLiteConnection | null = null;
  private db: SQLiteDBConnection | null = null;

  async init(): Promise<void> {
    if (this.db) return;

    this.sqlite = new SQLiteConnection(CapacitorSQLite);

    // On web, initialise the wasm jeep-sqlite store first.
    if (Capacitor.getPlatform() === 'web') {
      // Requires <jeep-sqlite> custom element to be registered in index.html (Phase 1c).
      await customElements.whenDefined('jeep-sqlite').catch(() => undefined);
      await this.sqlite.initWebStore();
    }

    const isConn = (await this.sqlite.isConnection(DB_NAME, false)).result;
    this.db = isConn
      ? await this.sqlite.retrieveConnection(DB_NAME, false)
      : await this.sqlite.createConnection(DB_NAME, false, 'no-encryption', DB_VERSION, false);

    await this.db.open();
    await this.db.execute(SCHEMA_SQL);
  }

  getDb(): SQLiteDBConnection {
    if (!this.db) throw new Error('StorageService not initialised');
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
 * Initial schema. Intentionally minimal in Phase 1 — tables grow in Phase 7.
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
`;
