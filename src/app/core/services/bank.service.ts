import { Injectable, inject } from '@angular/core';
import { firstValueFrom, Observable, tap, map } from 'rxjs';
import { ApiService } from './api.service';
import { ReferenceCacheService } from './reference-cache.service';
import { XmlLoaderService } from './xml-loader.service';
import type { Bank, Branch, Client } from '../models';

const CACHE_KEY_BANKS = 'phase4.banks';
const CACHE_KEY_CLIENTS = 'phase4.clients';
const CACHE_KEY_BRANCHES = (state: string, clientType: string) =>
  `phase4.branches.${clientType}.${state}`;

/**
 * Wraps the bank / client / branch endpoints on the TrackingApi.
 *
 * Three-layer resolution for offline-first behaviour:
 *   1. SQLite reference cache (most recent successful fetch)
 *   2. Live API (when online; populates cache on success)
 *   3. Bundled XML manifest (banks.xml / branches.xml) as a last-resort
 *      offline fallback. Source: legacy CurtisTracker assets.
 *
 * The XML fallback is bank-only — branches.xml does not encode state,
 * so getBranchesByStateWithCache falls back to filtering by bank id
 * instead when a state-keyed branch list is unavailable.
 *
 * Wire-shape normalisation
 * ========================
 * The live API uses verbose, server-specific field names:
 *   Branch: { branchId, branch, clientid, clientName, branchAddress, state }
 *   Bank:   { clientid, clientName, ... }
 *
 * Internal models expect the canonical shape:
 *   Branch: { id, name, bankId, bankName, address, state }
 *   Bank:   { id, name, code }
 *
 * Both `normalizeBranch` and `normalizeBank` accept either shape — if
 * `id`/`name` are already present they pass through, otherwise the server
 * field names are mapped in. This keeps the XML fallback working
 * unchanged while making the live API responses usable.
 */
@Injectable({ providedIn: 'root' })
export class BankService {
  private readonly api = inject(ApiService);
  private readonly cache = inject(ReferenceCacheService);
  private readonly xml = inject(XmlLoaderService);

  /** GET /GetBanks — returns all banks. */
  getBanks(): Observable<Bank[]> {
    return this.api.get<unknown[]>('/GetBanks').pipe(
      map((list) => (list ?? []).map((b) => this.normalizeBank(b))),
      tap((banks) => void this.cache.set(CACHE_KEY_BANKS, banks)),
    );
  }

  async getBanksWithCache(): Promise<Bank[]> {
    const rawCached = (await this.cache.get<unknown[]>(CACHE_KEY_BANKS)) ?? [];
    const cached = rawCached.map((b) => this.normalizeBank(b)).filter((b) => b.id && b.name);
    if (cached.length > 0) {
      // Still fire a background refresh.
      void firstValueFrom(this.getBanks()).catch(() => undefined);
      return cached;
    }
    try {
      const fresh = await firstValueFrom(this.getBanks());
      if (fresh && fresh.length > 0) return fresh;
    } catch {
      // fall through to XML
    }
    return this.xml.loadBanks();
  }

  /**
   * GET /GetClients?clientType=... — list of clients of a given type.
   * Defaults to 'Bank' per the OpenAPI spec.
   */
  getClients(clientType: string = 'Bank'): Observable<Client[]> {
    return this.api.get<Client[]>('/GetClients', { clientType }).pipe(
      tap((clients) => void this.cache.set(`${CACHE_KEY_CLIENTS}.${clientType}`, clients)),
    );
  }

  async getClientsWithCache(clientType: string = 'Bank'): Promise<Client[]> {
    const cached = (await this.cache.get<Client[]>(`${CACHE_KEY_CLIENTS}.${clientType}`)) ?? [];
    try {
      const fresh = await firstValueFrom(this.getClients(clientType));
      return fresh ?? cached;
    } catch {
      return cached;
    }
  }

  /**
   * GET /GetBranchesByState/{state}?clientType=... — branches for a state,
   * optionally filtered by client type.
   */
  getBranchesByState(state: string, clientType: string = 'Bank'): Observable<Branch[]> {
    const path = `/GetBranchesByState/${encodeURIComponent(state)}`;
    return this.api.get<unknown[]>(path, { clientType }).pipe(
      map((list) => (list ?? []).map((b) => this.normalizeBranch(b))),
      tap((branches) => void this.cache.set(CACHE_KEY_BRANCHES(state, clientType), branches)),
    );
  }

  async getBranchesByStateWithCache(state: string, clientType: string = 'Bank'): Promise<Branch[]> {
    const key = CACHE_KEY_BRANCHES(state, clientType);
    const rawCached = (await this.cache.get<unknown[]>(key)) ?? [];
    const cached = rawCached
      .map((b) => this.normalizeBranch(b))
      .filter((b) => b.id && b.name);
    if (cached.length > 0) {
      void firstValueFrom(this.getBranchesByState(state, clientType)).catch(() => undefined);
      return cached;
    }
    try {
      const fresh = await firstValueFrom(this.getBranchesByState(state, clientType));
      if (fresh && fresh.length > 0) return fresh;
    } catch {
      // fall through
    }
    // XML fallback — branches.xml is keyed by bank, not state, so we can
    // only return the full list. Callers can filter further client-side.
    return this.xml.loadBranches();
  }

  /**
   * Get branches for a specific bank. Bypasses the state cascade entirely;
   * useful for the manual-evacuation flow which picks bank then branch.
   * Always uses the XML fallback because no API endpoint exists for this.
   */
  async getBranchesForBank(bankId: string): Promise<Branch[]> {
    return this.xml.loadBranchesForBank(bankId);
  }

  // ---------------------------------------------------------------------------
  // Wire-shape normalisers
  // ---------------------------------------------------------------------------

  /**
   * Coerce a raw branch object (from API or XML) into the canonical Branch
   * shape used by the rest of the app. Accepts either:
   *   Server:  { branchId, branch, clientid, clientName, branchAddress, state }
   *   Canonical/XML: { id, name, bankId, bankName, address, state }
   */
  private normalizeBranch(raw: unknown): Branch {
    const b = (raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {});
    const pickString = (...keys: string[]): string | undefined => {
      for (const k of keys) {
        const v = b[k];
        if (typeof v === 'string' && v.length > 0) return v;
      }
      return undefined;
    };
    return {
      ...b,
      id: pickString('id', 'branchId') ?? '',
      name: pickString('name', 'branch') ?? '',
      bankId: pickString('bankId', 'clientid') ?? '',
      bankName: pickString('bankName', 'clientName'),
      state: pickString('state'),
      address: pickString('address', 'branchAddress'),
    } as Branch;
  }

  /**
   * Coerce a raw bank object (from API or XML) into the canonical Bank shape.
   * Accepts either:
   *   Server:    { clientid, clientName, ... }
   *   Canonical/XML: { id, name, code }
   */
  private normalizeBank(raw: unknown): Bank {
    const b = (raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {});
    const pickString = (...keys: string[]): string | undefined => {
      for (const k of keys) {
        const v = b[k];
        if (typeof v === 'string' && v.length > 0) return v;
      }
      return undefined;
    };
    return {
      ...b,
      id: pickString('id', 'clientid', 'clientId') ?? '',
      name: pickString('name', 'clientName') ?? '',
      code: pickString('code'),
    } as Bank;
  }
}
