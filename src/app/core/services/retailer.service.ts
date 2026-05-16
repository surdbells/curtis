import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BankService } from './bank.service';
import { XmlLoaderService } from './xml-loader.service';
import { ReferenceCacheService } from './reference-cache.service';
import type { Retailer, RetailerBranch, Client } from '../models';

const CACHE_KEY_RETAILERS = 'phase5.retailers';

/**
 * Retailer-side mirror of BankService.
 *
 * Retailers are a distinct concept from banks in the legacy CurtisTracker
 * data model (e.g. NNPC, OANDO, MR PRICE) and have their own branches.
 *
 * Resolution order:
 *   1. SQLite reference cache (most recent successful API fetch via
 *      BankService.getClientsWithCache(clientType='Retail'))
 *   2. Bundled retail.xml manifest (offline fallback)
 *
 * The retailer branches are XML-only — the API has no /GetRetailerBranches
 * endpoint, so we rely on the bundled rtbranch.xml manifest.
 */
@Injectable({ providedIn: 'root' })
export class RetailerService {
  private readonly banks = inject(BankService);
  private readonly xml = inject(XmlLoaderService);
  private readonly cache = inject(ReferenceCacheService);

  /**
   * Returns the merged retailer list. Prefers API response shape if
   * available; falls back to retail.xml otherwise.
   */
  async getRetailers(): Promise<Retailer[]> {
    // Try cache -> API -> XML, in that order.
    const cached = (await this.cache.get<Retailer[]>(CACHE_KEY_RETAILERS)) ?? [];
    if (cached.length > 0) {
      // Background refresh.
      void this.refreshFromApi().catch(() => undefined);
      return cached;
    }
    const fresh = await this.refreshFromApi().catch(() => null);
    if (fresh && fresh.length > 0) return fresh;
    return this.xml.loadRetailers();
  }

  /** Branches of a retailer. XML-only (no API endpoint). */
  async getBranchesForRetailer(retailerId: string): Promise<RetailerBranch[]> {
    return this.xml.loadBranchesForRetailer(retailerId);
  }

  private async refreshFromApi(): Promise<Retailer[] | null> {
    try {
      const clients = await firstValueFrom(this.banks.getClients('Retail'));
      const mapped = (clients ?? []).map(this.clientToRetailer).filter((r): r is Retailer => !!r);
      if (mapped.length > 0) {
        await this.cache.set(CACHE_KEY_RETAILERS, mapped);
        return mapped;
      }
    } catch {
      // ignore
    }
    return null;
  }

  private clientToRetailer = (c: Client): Retailer | null => {
    if (!c?.id) return null;
    return { id: String(c.id), name: c.name ?? String(c.id) };
  };
}
