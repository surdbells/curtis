/**
 * Bank returned by GET /GetBanks or extracted from banks.xml.
 *
 * Confirmed shape from legacy CurtisTracker:
 *   <Bank id="<GUID>">{name}</Bank>
 */
export interface Bank {
  id: string;
  name: string;
  code?: string;
  [key: string]: unknown;
}

/**
 * Branch returned by GET /GetBranchesByState/{state} or extracted from
 * branches.xml.
 *
 * Confirmed shape from legacy CurtisTracker:
 *   <Branch id="<GUID>" bankid="<GUID>" bank="<bank name>">{branch name}</Branch>
 *
 * Address, state, and coordinates are not in the XML manifest but may be
 * present on the live API response — left optional.
 */
export interface Branch {
  id: string;
  bankId: string;
  bankName?: string;
  name: string;
  state?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  [key: string]: unknown;
}

/**
 * Client returned by GET /GetClients?clientType=...
 * The API supports a pluggable clientType (default "Bank").
 */
export interface Client {
  id: string;
  name?: string;
  type?: string;
  [key: string]: unknown;
}
