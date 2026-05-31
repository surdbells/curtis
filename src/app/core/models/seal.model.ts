/**
 * UI-only shape used by `<curtis-seal-list>` to render the per-stop scan
 * checklist on the Delivery-Scan page.
 *
 * This is NOT a backend response type. The route's expected-seals list
 * arrives as a `string[]` on RouteStop.seals (from `/GetRoute/{routeid}`),
 * and the Delivery-Scan page wraps each id into a `Seal` for display.
 *
 * History: This type was originally meant to model `/GetIncomingSealsBy*`
 * responses, which powered the bank-scan and route-scan pages. Both
 * endpoints + pages were retired in favour of per-stop scanning during
 * the Delivery flow, so the type is now purely presentational.
 */
export interface Seal {
  /** Unique identifier — typically the raw seal reference string. */
  id: string;
  /** Display number (often identical to id). */
  number?: string;
  /** Lifecycle status for the seal-list row. */
  status?: SealStatus;
}

export type SealStatus = 'pending' | 'scanned' | 'missing' | 'damaged' | string;
