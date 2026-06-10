/**
 * Route codes — verbatim from legacy CurtisTracker
 * `res/values/strings.xml` `<string-array name="routes">`.
 *
 * These are the route IDs the agent may pick on the Scan-by-Route page
 * (and the backend's spinner of choice on the legacy Android app).
 * Sent on the wire as `routeid` for /PostIncomingSealsByRoute.
 */
export const ROUTE_CODES: readonly string[] = [
  '0',
  '1',
  '2a',
  '2b',
  '3a',
  '3b',
  '4',
  '5a',
  '5b',
  '5c',
  '6',
  '7',
  '8a',
  '8b',
  '9',
  '10',
  '11',
  '12',
  '13a',
  '13b',
  '14',
  '777',
] as const;

export type RouteCode = (typeof ROUTE_CODES)[number];
