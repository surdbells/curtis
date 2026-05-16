/**
 * Retailer — first-class concept distinct from Bank.
 * Sourced from retail.xml (legacy CurtisTracker asset) or the
 * /GetClients?clientType=Retail endpoint.
 *
 * Examples: NNPC, OANDO, MR PRICE, GAME, etc.
 */
export interface Retailer {
  id: string;
  name: string;
}

/**
 * RetailerBranch — branch of a retailer.
 * Sourced from rtbranch.xml or /GetBranchesByState/{state}?clientType=Retail.
 *
 * Keyed to a parent retailer via retailerId.
 */
export interface RetailerBranch {
  id: string;
  retailerId: string;
  retailerName?: string;
  name: string;
}
