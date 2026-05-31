/**
 * Route + assignment models, aligned with the TrackingApi v1 backend
 * sample responses captured 2026-05.
 *
 * The backend exposes two endpoints for routes:
 *
 *   GET /GetRouteByUserId       → assignment lookup: { userId, routeId }
 *   GET /GetRoute/{routeid}     → array of jobs (one per stop on the route)
 *
 * Neither endpoint alone gives the client what it wants. `RouteService.getMyRoute()`
 * composes them into the `Route` shape below.
 */

/**
 * Raw response shape from GET /GetRouteByUserId.
 *
 * The agent's user is mapped to a single active route id. The id is an
 * opaque string (the backend sample showed "1") — treat it as such, do not
 * parseInt.
 */
export interface RouteAssignment {
  userId: string;
  routeId: string;
}

/**
 * Per-job entry from GET /GetRoute/{routeid}. The backend returns these
 * as an array under the `data` envelope key. Each entry is one stop the
 * agent must visit during the route — a delivery job at a bank branch.
 *
 * Fields map directly from backend keys (no renaming). The shape was
 * derived from this sample:
 *
 *   {
 *     "referenceNumber": "40EA1665-279F-42D6-91BF-3B1124DBF175",
 *     "refNo": "Y237135322",
 *     "clientName": "Guaranty Trust Bank Plc",
 *     "branchId": "A23482AB-5AFB-4917-8578-1B8CE108427F",
 *     "pickupLocation": "(GTB)BW",
 *     "destination": "(GTB)Adetokunbo Ademola - Plot 714 ...",
 *     "clientIdNumber": "33C7935B-AF01-42D6-9A0F-B292828A2D75",
 *     "stopNumber": 15,
 *     "status": "Scheduled For Delivery",
 *     "seals": ["8911", "8910"]
 *   }
 */
export interface RouteStop {
  /** Server-side unique identifier for this job. UUID. */
  referenceNumber: string;
  /** Human-readable reference (e.g. "Y237135322"). Displayed on receipts. */
  refNo: string;
  /** Client/bank display name for this stop (e.g. "Guaranty Trust Bank Plc"). */
  clientName: string;
  /** Branch UUID. Pair with GetBranchesByState to resolve name/address detail. */
  branchId: string;
  /** Server-described pickup location string (e.g. "(GTB)BW"). */
  pickupLocation: string;
  /** Server-described destination — already human-readable, suitable for UI. */
  destination: string;
  /** Client (bank) UUID. */
  clientIdNumber: string;
  /** 1-based sequence position on the route. */
  stopNumber: number;
  /** Backend lifecycle status string (e.g. "Scheduled For Delivery"). */
  status: string;
  /** Pre-known seal references expected at this stop. */
  seals: string[];
}

/**
 * Composed Route — what the dashboard and downstream pages consume.
 *
 * Not a raw backend shape: this is assembled in `RouteService.getMyRoute()`
 * from the assignment + the job list. `clientName` is derived from the
 * first stop (in practice all stops on a single route share the same
 * client/bank).
 */
export interface Route {
  /** Numeric route id from the assignment lookup (opaque string, e.g. "1"). */
  routeId: string;
  /** Display name for the route — typically the client bank's name. */
  clientName: string;
  /** Jobs on the route, ordered by stopNumber. */
  stops: RouteStop[];
}
