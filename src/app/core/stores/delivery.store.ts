import { Injectable, computed, signal } from '@angular/core';

/**
 * Holds the state of the currently-in-progress delivery.
 *
 * Populated when the agent taps a stop on Daily → Delivery info → Check-In.
 * Cleared on successful Check-Out. Drives which steps of the flow are
 * enabled (Scan gated on check-in, Process gated on scan, Check-Out gated
 * on signature).
 *
 * NOTE: This is transient state — not persisted across app restarts.
 * If the app is killed mid-delivery the agent restarts from Daily.
 */
@Injectable({ providedIn: 'root' })
export class DeliveryStore {
  private readonly _stopId = signal<string | null>(null);
  private readonly _bankId = signal<string | null>(null);
  private readonly _branchId = signal<string | null>(null);
  private readonly _state = signal<string | null>(null);
  private readonly _checkInAt = signal<string | null>(null);

  /**
   * Seals the route response said should be delivered at this stop.
   * Source: RouteStop.seals from GET /GetRoute/{routeid}. Populated when
   * the agent selects a stop from Daily.
   */
  private readonly _expectedSeals = signal<readonly string[]>([]);

  /**
   * Seals the agent has actually scanned at this stop. Populated by the
   * DeliveryScan screen. Used downstream by Process and Check-Out to
   * compose the final POST payloads.
   */
  private readonly _scannedSeals = signal<readonly string[]>([]);

  private readonly _processComplete = signal<boolean>(false);
  private readonly _signatureBase64 = signal<string | null>(null);
  private readonly _checkOutAt = signal<string | null>(null);

  readonly stopId = this._stopId.asReadonly();
  readonly bankId = this._bankId.asReadonly();
  readonly branchId = this._branchId.asReadonly();
  readonly state = this._state.asReadonly();
  readonly checkInAt = this._checkInAt.asReadonly();
  readonly expectedSeals = this._expectedSeals.asReadonly();
  readonly scannedSeals = this._scannedSeals.asReadonly();
  readonly processComplete = this._processComplete.asReadonly();
  readonly signatureBase64 = this._signatureBase64.asReadonly();
  readonly checkOutAt = this._checkOutAt.asReadonly();

  readonly isCheckedIn = computed(() => !!this._checkInAt());
  readonly hasSignature = computed(() => !!this._signatureBase64());

  /**
   * True when the scan step is complete — every expected seal has been
   * scanned. If the stop had no expected seals (older routes / data
   * cleanup), the step is considered trivially complete.
   */
  readonly scanComplete = computed(() => {
    const expected = this._expectedSeals();
    if (expected.length === 0) return true;
    const scanned = new Set(this._scannedSeals());
    return expected.every((id) => scanned.has(id));
  });

  /** Seals scanned that were NOT in the expected list (anomaly). */
  readonly unexpectedScans = computed(() => {
    const expected = new Set(this._expectedSeals());
    return this._scannedSeals().filter((id) => !expected.has(id));
  });

  /** Seals expected but NOT scanned yet. */
  readonly missingScans = computed(() => {
    const scanned = new Set(this._scannedSeals());
    return this._expectedSeals().filter((id) => !scanned.has(id));
  });

  readonly canCheckOut = computed(
    () => this.isCheckedIn() && this.hasSignature(),
  );

  /**
   * Start a new delivery. Called when the agent taps a stop on Daily and
   * lands on Delivery info. Seeds the expected seals for the scan step.
   */
  beginDelivery(args: {
    stopId: string;
    bankId?: string | null;
    branchId?: string | null;
    state?: string | null;
    expectedSeals?: readonly string[];
  }): void {
    this._stopId.set(args.stopId);
    this._bankId.set(args.bankId ?? null);
    this._branchId.set(args.branchId ?? null);
    this._state.set(args.state ?? null);
    this._expectedSeals.set(args.expectedSeals ?? []);
    this._scannedSeals.set([]);
    this._checkInAt.set(null);
    this._processComplete.set(false);
    this._signatureBase64.set(null);
    this._checkOutAt.set(null);
  }

  /** Agent manually changed the bank/branch selection on Delivery. */
  setBankBranch(args: { bankId: string; branchId: string; state?: string | null }): void {
    this._bankId.set(args.bankId);
    this._branchId.set(args.branchId);
    if (args.state !== undefined) this._state.set(args.state);
  }

  markCheckedIn(timestamp: string): void {
    this._checkInAt.set(timestamp);
  }

  /** Replace the scanned-seals list (called from DeliveryScan submit). */
  setScannedSeals(ids: readonly string[]): void {
    // De-dupe while preserving insertion order.
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const id of ids) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      deduped.push(id);
    }
    this._scannedSeals.set(deduped);
  }

  markProcessComplete(): void {
    this._processComplete.set(true);
  }

  setSignature(base64: string): void {
    this._signatureBase64.set(base64);
  }

  clearSignature(): void {
    this._signatureBase64.set(null);
  }

  markCheckedOut(timestamp: string): void {
    this._checkOutAt.set(timestamp);
  }

  /** Reset everything — called after successful check-out or on agent cancel. */
  clear(): void {
    this._stopId.set(null);
    this._bankId.set(null);
    this._branchId.set(null);
    this._state.set(null);
    this._checkInAt.set(null);
    this._expectedSeals.set([]);
    this._scannedSeals.set([]);
    this._processComplete.set(false);
    this._signatureBase64.set(null);
    this._checkOutAt.set(null);
  }
}
