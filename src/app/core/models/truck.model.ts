/**
 * Truck returned by GET /GetTruckByUserId and GET /GetTrucks.
 * TODO(phase-3): align with backend sample.
 */
export interface Truck {
  id: string;
  plate?: string;
  model?: string;
  capacity?: string | number;
  mileage?: string | number;
  gasLevel?: string | number;
  [key: string]: unknown;
}
