/**
 * Route returned by GET /GetRouteByUserId and GET /GetRoute/{routeid}.
 *
 * Shape is a best-guess skeleton — actual field names/types to be confirmed
 * in Phase 3 when real sample payloads are available.
 * TODO(phase-3): align with backend sample.
 */
export interface Route {
  id: string;
  name?: string;
  date?: string;
  status?: string;
  stops?: RouteStop[];
  [key: string]: unknown;
}

export interface RouteStop {
  id: string;
  sequence?: number;
  bankId?: string;
  branchId?: string;
  branchName?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  status?: string;
  [key: string]: unknown;
}
