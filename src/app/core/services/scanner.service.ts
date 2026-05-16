import { Injectable } from '@angular/core';
import {
  BarcodeScanner,
  BarcodeFormat,
  Barcode,
} from '@capacitor-mlkit/barcode-scanning';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

export interface ScanSession {
  /** Stop the scanner and clean up listeners. */
  stop(): Promise<void>;
}

export interface ContinuousScanOptions {
  /** Allowed formats. Defaults to QR + Code128 + Code39 (typical CIT seal codes). */
  formats?: BarcodeFormat[];
  /** Suppress duplicate raw values within the session. Default: true. */
  dedupe?: boolean;
  /** Fire haptic on each successful scan. Default: true. */
  haptic?: boolean;
}

/**
 * Camera-based QR / barcode scanner using Google ML Kit.
 *
 * Two modes:
 *   - scanOnce(): single-shot scan that returns the first detected value.
 *   - startContinuous(onScan): camera stays open, fires callback per
 *     detection, deduplicates by raw value (so the same seal can't double-
 *     count if held in front of the camera for >1 frame).
 *
 * Continuous mode is the field-ops workflow per legacy CurtisTracker
 * (ZXingScannerView with resumeCameraPreview after each result).
 *
 * On web, BarcodeScanner is a no-op — startContinuous resolves with a
 * stop() that does nothing.
 */
@Injectable({ providedIn: 'root' })
export class ScannerService {
  /** Confirms the ML Kit module is installed / installable on this device. */
  async ensureReady(): Promise<void> {
    if (Capacitor.getPlatform() === 'web') return;
    const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
    if (!available) {
      await BarcodeScanner.installGoogleBarcodeScannerModule();
    }
  }

  /**
   * Open the scanner UI for a single detection. Returns null if the user
   * cancels.
   */
  async scanOnce(
    formats: BarcodeFormat[] = [BarcodeFormat.QrCode, BarcodeFormat.Code128, BarcodeFormat.Code39],
  ): Promise<string | null> {
    if (Capacitor.getPlatform() === 'web') return null;
    await this.ensureReady();
    const { barcodes }: { barcodes: Barcode[] } = await BarcodeScanner.scan({ formats });
    return barcodes[0]?.rawValue ?? null;
  }

  /**
   * Start a continuous scan session. Camera stays open until stop() is
   * called on the returned handle. `onScan` is invoked with each
   * deduplicated detection.
   *
   * The Capacitor MLKit plugin emits 'barcodesScanned' for each frame's
   * detections. We attach a listener, call startScan(), and clean up via
   * stopScan() + listener.remove() on stop().
   */
  async startContinuous(
    onScan: (value: string) => void,
    options: ContinuousScanOptions = {},
  ): Promise<ScanSession> {
    if (Capacitor.getPlatform() === 'web') {
      // Web fallback: provide a stop() that does nothing.
      return { stop: async () => undefined };
    }

    await this.ensureReady();

    const formats = options.formats ?? [
      BarcodeFormat.QrCode,
      BarcodeFormat.Code128,
      BarcodeFormat.Code39,
    ];
    const dedupe = options.dedupe ?? true;
    const haptic = options.haptic ?? true;
    const seen = new Set<string>();

    const listener: PluginListenerHandle = await BarcodeScanner.addListener(
      'barcodesScanned',
      (result) => {
        const detections = (result.barcodes ?? []) as Barcode[];
        for (const b of detections) {
          const value = b.rawValue ?? '';
          if (!value) continue;
          if (dedupe && seen.has(value)) continue;
          seen.add(value);
          if (haptic) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
          onScan(value);
        }
      },
    );

    await BarcodeScanner.startScan({ formats });

    return {
      stop: async () => {
        try {
          await BarcodeScanner.stopScan();
        } catch {
          // ignore
        }
        try {
          await listener.remove();
        } catch {
          // ignore
        }
      },
    };
  }
}
