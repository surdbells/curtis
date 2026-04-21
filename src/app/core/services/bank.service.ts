import { Injectable, inject } from '@angular/core';
import { firstValueFrom, Observable, from, of, switchMap, tap } from 'rxjs';
import { ApiService } from './api.service';
import { ReferenceCacheService } from './reference-cache.service';
import type { Bank, Branch, Client } from '../models';

const CACHE_KEY_BANKS = 'phase4.banks';
const CACHE_KEY_CLIENTS = 'phase4.clients';
const CACHE_KEY_BRANCHES = (state: string, clientType: string) =>
  `phase4.branches.${clientType}.${state}`;

/**
 * Wraps the bank / client / branch endpoints on the TrackingApi.
 *
 * All reads are cached via ReferenceCacheService so the agent can still
 * pick a bank and branch while offline — the cache is refreshed on every
 * successful fetch.
 *
 * TODO(phase-4-samples): tighten Bank, Branch, and Client models once
 * backend provides real response samples.
 */
@Injectable({ providedIn: 'root' })
export class BankService {
  private readonly api = inject(ApiService);
  private readonly cache = inject(ReferenceCacheService);

  /** GET /GetBanks — returns all banks. */
  getBanks(): Observable<Bank[]> {
    return this.api.get<Bank[]>('/GetBanks').pipe(
      tap((banks) => void this.cache.set(CACHE_KEY_BANKS, banks)),
    );
  }

  async getBanksWithCache(): Promise<Bank[]> {
    const cached = (await this.cache.get<Bank[]>(CACHE_KEY_BANKS)) ?? [];
    try {
      const fresh = await firstValueFrom(this.getBanks());
      return fresh ?? cached;
    } catch {
      return cached;
    }
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
    try {
      const fresh = await firstValueFrom(this.getBranchesByState(state, clientType));
      return fresh ?? cached;
    } catch {
      return cached;
    }
  }
}
