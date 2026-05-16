import { Injectable, inject } from '@angular/core';
import { firstValueFrom, Observable, tap } from 'rxjs';
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
 */
@Injectable({ providedIn: 'root' })
export class BankService {
  private readonly api = inject(ApiService);
  private readonly cache = inject(ReferenceCacheService);
  private readonly xml = inject(XmlLoaderService);

  /** GET /GetBanks — returns all banks. */
  getBanks(): Observable<Bank[]> {
    return this.api.get<Bank[]>('/GetBanks').pipe(
      tap((banks) => void this.cache.set(CACHE_KEY_BANKS, banks)),
    );
  }

  async getBanksWithCache(): Promise<Bank[]> {
    const cached = (await this.cache.get<Bank[]>(CACHE_KEY_BANKS)) ?? [];
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
    return this.api.get<Branch[]>(path, { clientType }).pipe(
      tap((branches) => void this.cache.set(CACHE_KEY_BRANCHES(state, clientType), branches)),
    );
  }

  async getBranchesByStateWithCache(state: string, clientType: string = 'Bank'): Promise<Branch[]> {
    const key = CACHE_KEY_BRANCHES(state, clientType);
    const cached = (await this.cache.get<Branch[]>(key)) ?? [];
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
}
