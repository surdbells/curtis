import { Injectable, computed, signal } from '@angular/core';

/**
 * Holds the state of the currently-in-progress delivery.
 *
 * Populated when the agent taps a stop on Daily → Delivery info → Check-In.
 * Cleared on successful Check-Out. Drives which steps of the flow are
 * enabled (Process gated on check-in, Check-Out gated on signature).
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
  private readonly _processComplete = signal<boolean>(false);
  private readonly _signatureBase64 = signal<string | null>(null);
  private readonly _checkOutAt = signal<string | null>(null);

  readonly stopId = this._stopId.asReadonly();
  readonly bankId = this._bankId.asReadonly();
  readonly branchId = this._branchId.asReadonly();
  readonly state = this._state.asReadonly();
  readonly checkInAt = this._checkInAt.asReadonly();
  readonly processComplete = this._processComplete.asReadonly();
  readonly signatureBase64 = this._signatureBase64.asReadonly();
  readonly checkOutAt = this._checkOutAt.asReadonly();

  readonly isCheckedIn = computed(() => !!this._checkInAt());
  readonly hasSignature = computed(() => !!this._signatureBase64());
  readonly canCheckOut = computed(
    () => this.isCheckedIn() && this.hasSignature(),
  );

  /**
   * Start a new delivery. Called when the agent taps a stop on Daily and
   * lands on Delivery info.
   */
  beginDelivery(args: {
    stopId: string;
    bankId?: string | null;
    branchId?: string | null;
    state?: string | null;
  }): void {
    this._stopId.set(args.stopId);
    this._bankId.set(args.bankId ?? null);
    this._branchId.set(args.branchId ?? null);
    this._state.set(args.state ?? null);
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
    this._processComplete.set(false);
    this._signatureBase64.set(null);
    this._checkOutAt.set(null);
  }
}
