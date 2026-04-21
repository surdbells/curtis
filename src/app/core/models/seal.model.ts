/**
 * Seal returned by the /GetIncomingSealsBy{Route|Bank} endpoints and posted
 * back via /PostIncomingSealsBy{Route|Bank}.
 *
 * TODO(phase-5): align with backend sample. The backend likely sends an array
 * of seal objects; we'll post them back either as a JSON-encoded string or
 * comma-separated IDs via DevicePostDto.seals.
 */
export interface Seal {
  id: string;
  number?: string;
  status?: SealStatus;
  bankId?: string;
  branchId?: string;
  routeId?: string;
  [key: string]: unknown;
}

export type SealStatus = 'pending' | 'scanned' | 'missing' | 'damaged' | string;
