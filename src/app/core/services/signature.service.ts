import { Injectable } from '@angular/core';

/**
 * Signature service.
 *
 * The drawing UI lives in SignaturePadComponent (Phase 1b). This service is
 * a small helper for common operations like normalising a data URL into the
 * raw base64 string expected by DevicePostDto.signature.
 */
@Injectable({ providedIn: 'root' })
export class SignatureService {
  /**
   * Strips the `data:image/png;base64,` prefix if present and returns the
   * raw base64 payload. No-op if already raw.
   */
  toRawBase64(dataUrlOrRaw: string): string {
    const comma = dataUrlOrRaw.indexOf(',');
    if (dataUrlOrRaw.startsWith('data:') && comma !== -1) {
      return dataUrlOrRaw.slice(comma + 1);
    }
    return dataUrlOrRaw;
  }
}
