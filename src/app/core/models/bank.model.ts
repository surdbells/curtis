/**
 * Bank returned by GET /GetBanks.
 * TODO(phase-4): align with backend sample.
 */
export interface Bank {
  id: string;
  name?: string;
  code?: string;
  [key: string]: unknown;
}

/**
 * Branch returned by GET /GetBranchesByState/{state}.
 * TODO(phase-4): align with backend sample.
 */
export interface Branch {
  id: string;
  bankId?: string;
  name?: string;
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
