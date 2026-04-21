import { Injectable } from '@angular/core';
import {
  BarcodeScanner,
  BarcodeFormat,
  Barcode,
} from '@capacitor-mlkit/barcode-scanning';

/**
 * QR / barcode scanner wrapper (Google ML Kit via Capacitor).
 * Used for seal scanning during route and bank evacuation flows.
 *
 * TODO(phase-5): wire to seal-list UI with haptic feedback on each scan,
 * continuous-scan mode, and seal-matching against the downloaded manifest.
 */
@Injectable({ providedIn: 'root' })
export class ScannerService {
  /** Confirms the ML Kit module is installed / installable on this device. */
  async ensureReady(): Promise<void> {
    const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
    if (!available) {
      await BarcodeScanner.installGoogleBarcodeScannerModule();
    }
  }

  /**
   * One-shot scan. Returns the raw string value of the first barcode detected,
   * or null if the user cancelled.
   */
  async scanOnce(formats: BarcodeFormat[] = [BarcodeFormat.QrCode, BarcodeFormat.Code128]): Promise<string | null> {
    await this.ensureReady();
    const { barcodes }: { barcodes: Barcode[] } = await BarcodeScanner.scan({ formats });
    return barcodes[0]?.rawValue ?? null;
  }
}
