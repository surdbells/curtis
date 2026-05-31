/**
 * Truck + assignment models, aligned with the TrackingApi v1 backend
 * sample responses captured 2026-05.
 *
 * The backend exposes two endpoints for trucks:
 *
 *   GET /GetTruckByUserId  → assignment lookup: { userId, truckId }
 *   GET /GetTrucks         → array of all trucks
 *
 * There is no GET /GetTruck/{id}. `TruckService.getMyTruck()` therefore
 * does assignment → list → filter to compose the full Truck.
 */

/**
 * Raw response shape from GET /GetTruckByUserId.
 *
 * The agent's user is mapped to a single assigned truck. `truckId` is the
 * same opaque string used as `id` in GET /GetTrucks rows (e.g. "AGL47XJ").
 */
export interface TruckAssignment {
  userId: string;
  truckId: string;
}

/**
 * Full truck record from GET /GetTrucks. Backend sample:
 *
 *   { "id": "AGL47XJ", "plateNo": "AGL 47 XJ", "make": "AGRALE",
 *     "model": "AGRALE", "year": "NA" }
 *
 * `year` arrives as a string because the backend sometimes returns "NA"
 * when unknown — do not type as number.
 */
export interface Truck {
  /** Server-side unique identifier (matches TruckAssignment.truckId). */
  id: string;
  /** Display plate number with spaces (e.g. "AGL 47 XJ"). */
  plateNo: string;
  /** Manufacturer (e.g. "AGRALE", "FORD"). */
  make: string;
  /** Model designation (often duplicates make on this fleet). */
  model: string;
  /** Year of manufacture as a string. "NA" when unknown. */
  year: string;
}
