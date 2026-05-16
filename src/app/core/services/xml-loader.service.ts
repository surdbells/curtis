import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { XMLParser } from 'fast-xml-parser';

import type { Bank, Branch, Retailer, RetailerBranch } from '../models';

/**
 * Loads the legacy CurtisTracker XML reference manifests shipped under
 * `src/assets/data/` and exposes them as typed arrays.
 *
 * Used as the offline fallback for /GetBanks, /GetBranchesByState,
 * /GetClients?clientType=Retail, and the retailer branches list.
 *
 * File shapes (from legacy CurtisTracker):
 *   banks.xml      MyResult > Result > Banks    > Bank[@id]
 *   branches.xml   MyResult > Result > Branches > Branch[@id, @bankid, @bank]
 *   retail.xml     MyResult > Result > Retailers > Retailer[@id]
 *   rtbranch.xml   MyResult > Result > Branches > Branch[@id, @retailerid, @retailer]
 *
 * Each is loaded lazily on first request and cached in-memory for the
 * lifetime of the app instance.
 */
@Injectable({ providedIn: 'root' })
export class XmlLoaderService {
  private readonly http = inject(HttpClient);
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@',
    textNodeName: '_text',
    trimValues: true,
  });

  private banks: Bank[] | null = null;
  private branches: Branch[] | null = null;
  private retailers: Retailer[] | null = null;
  private retailerBranches: RetailerBranch[] | null = null;

  /**
   * Returns the bundled Bank list parsed from banks.xml.
   * Empty array if the manifest is missing or malformed.
   */
  async loadBanks(): Promise<Bank[]> {
    if (this.banks) return this.banks;
    const xml = await this.fetchXml('banks');
    if (!xml) {
      this.banks = [];
      return this.banks;
    }
    const list = this.asArray(xml?.MyResult?.Result?.Banks?.Bank);
    this.banks = list.map((node) => ({
      id: String(this.attr(node, 'id') ?? ''),
      name: this.text(node),
    })).filter((b) => b.id && b.name);
    return this.banks;
  }

  /**
   * Returns the bundled bank Branch list parsed from branches.xml.
   * Use loadBranchesForBank() for a per-bank slice.
   */
  async loadBranches(): Promise<Branch[]> {
    if (this.branches) return this.branches;
    const xml = await this.fetchXml('branches');
    if (!xml) {
      this.branches = [];
      return this.branches;
    }
    const list = this.asArray(xml?.MyResult?.Result?.Branches?.Branch);
    this.branches = list.map((node) => ({
      id: String(this.attr(node, 'id') ?? ''),
      bankId: String(this.attr(node, 'bankid') ?? ''),
      bankName: this.attr(node, 'bank'),
      name: this.text(node),
    })).filter((b) => b.id && b.bankId && b.name);
    return this.branches;
  }

  /** Convenience: branches for a specific bank id. */
  async loadBranchesForBank(bankId: string): Promise<Branch[]> {
    const all = await this.loadBranches();
    return all.filter((b) => b.bankId === bankId);
  }

  /** Retailer list parsed from retail.xml. */
  async loadRetailers(): Promise<Retailer[]> {
    if (this.retailers) return this.retailers;
    const xml = await this.fetchXml('retail');
    if (!xml) {
      this.retailers = [];
      return this.retailers;
    }
    const list = this.asArray(xml?.MyResult?.Result?.Retailers?.Retailer);
    this.retailers = list.map((node) => ({
      id: String(this.attr(node, 'id') ?? ''),
      name: this.text(node),
    })).filter((r) => r.id && r.name);
    return this.retailers;
  }

  /** Retailer-branch list parsed from rtbranch.xml. */
  async loadRetailerBranches(): Promise<RetailerBranch[]> {
    if (this.retailerBranches) return this.retailerBranches;
    const xml = await this.fetchXml('rtbranch');
    if (!xml) {
      this.retailerBranches = [];
      return this.retailerBranches;
    }
    const list = this.asArray(xml?.MyResult?.Result?.Branches?.Branch);
    this.retailerBranches = list.map((node) => ({
      id: String(this.attr(node, 'id') ?? ''),
      retailerId: String(this.attr(node, 'retailerid') ?? ''),
      retailerName: this.attr(node, 'retailer'),
      name: this.text(node),
    })).filter((b) => b.id && b.retailerId && b.name);
    return this.retailerBranches;
  }

  /** Convenience: branches for a specific retailer id. */
  async loadBranchesForRetailer(retailerId: string): Promise<RetailerBranch[]> {
    const all = await this.loadRetailerBranches();
    return all.filter((b) => b.retailerId === retailerId);
  }

  /** Clears all in-memory caches. */
  clearCache(): void {
    this.banks = null;
    this.branches = null;
    this.retailers = null;
    this.retailerBranches = null;
  }

  // --- internals ---

  private async fetchXml(name: 'banks' | 'branches' | 'retail' | 'rtbranch'): Promise<XmlDoc | null> {
    try {
      const xml = await firstValueFrom(
        this.http.get(`assets/data/${name}.xml`, { responseType: 'text' }),
      );
      const parsed = this.parser.parse(xml);
      return parsed as XmlDoc;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[XmlLoaderService] Could not load ${name}.xml`, err);
      return null;
    }
  }

  /** fast-xml-parser returns a single object when there's one match, an array otherwise. Normalise. */
  private asArray<T>(v: T | T[] | undefined | null): T[] {
    if (v === undefined || v === null) return [];
    return Array.isArray(v) ? v : [v];
  }

  private attr(node: unknown, key: string): string | undefined {
    if (typeof node === 'string' || node === undefined || node === null) return undefined;
    const n = node as Record<string, unknown>;
    const v = n[`@${key}`];
    return v === undefined || v === null ? undefined : String(v);
  }

  private text(node: unknown): string {
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return String(node);
    if (!node) return '';
    const n = node as Record<string, unknown>;
    const t = n['_text'];
    return t === undefined || t === null ? '' : String(t);
  }
}

interface XmlDoc {
  MyResult?: {
    Result?: {
      Banks?: { Bank?: unknown | unknown[] };
      Branches?: { Branch?: unknown | unknown[] };
      Retailers?: { Retailer?: unknown | unknown[] };
    };
  };
}
