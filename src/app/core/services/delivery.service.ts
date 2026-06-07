import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { ActionBuilderService } from './action-builder.service';
import { LocationService } from './location.service';
import { SignatureService } from './signature.service';
import { DeliveryStore } from '../stores/delivery.store';
import { ACTION } from '../models';
import { nowIsoUtc } from '../utils';

export interface CheckInInput {
  branchId: string;
  /** Optional note entered by the agent. */
  note?: string;
}

/**
 * Canonical status values posted to /PostStatusByUserId from the Status
 * step (between Scan and Sign in the stop hub).
 *
 * Spelling and casing are intentionally exactly as the backend expects.
 */
export type DeliveryStatus = 'PICKED UP' | 'IN-TRANSIT' | 'DELIVERED' | 'COMPLETED';

export const DELIVERY_STATUSES: readonly DeliveryStatus[] = [
  'PICKED UP',
  'IN-TRANSIT',
  'DELIVERED',
  'COMPLETED',
] as const;

export interface CheckOutInput {
  /** Optional note entered by the agent. */
  note?: string;
}

/**
 * Backend returns this envelope shape when the agent tries to perform the
 * same action twice (re-entry, retry, lost response on flaky network):
 *
 *   { status: "-1",
 *     message: "Your previous action was a check_in" /* or check_out *\/,
 *     data: null }
 *
 * The HTTP status code on this response is 400, so Angular's HttpClient
 * throws an HttpErrorResponse before ApiService.unwrap() runs — the
 * envelope ends up at `err.error`, not at the top-level `.message`.
 *
 * On unrelated unwrap-path errors (200 OK with status != "0") the envelope
 * IS thrown directly and the message sits at the top level. The detector
 * checks both shapes so the soft-success path triggers regardless of
 * which delivery vector the backend used.
 *
 * Regexes tolerate wording drift: case, punctuation, separators
 * between "check" and the suffix (underscore / dash / space / nothing).
 */
const REPEAT_CHECK_IN_RE = /previous\s+action\s+was\s+a?\s*check[_\s-]?in/i;
const REPEAT_CHECK_OUT_RE = /previous\s+action\s+was\s+a?\s*check[_\s-]?out/i;

function messageMatches(err: unknown, pattern: RegExp): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { message?: unknown; error?: unknown };

  // Case 1: HttpErrorResponse (400 path) — envelope is at err.error.
  if (e.error && typeof e.error === 'object') {
    const inner = (e.error as { message?: unknown }).message;
    if (typeof inner === 'string' && pattern.test(inner)) return true;
  }

  // Case 2: thrown envelope from ApiService.unwrap (200 OK + status != "0").
  if (typeof e.message === 'string' && pattern.test(e.message)) return true;

  return false;
}

function isAlreadyCheckedInError(err: unknown): boolean {
  return messageMatches(err, REPEAT_CHECK_IN_RE);
}

function isAlreadyCheckedOutError(err: unknown): boolean {
  return messageMatches(err, REPEAT_CHECK_OUT_RE);
}

/**
 * Delivery flow service.
 *
 * Each call wraps the action-specific POST and updates DeliveryStore so the
 * UI reacts. Wire payloads are aligned with the canonical backend spec —
 * only the fields the backend names are sent (plus the builder's auto-
 * injected deviceId / userid / utcDateTime / batterystatus).
 */
@Injectable({ providedIn: 'root' })
export class DeliveryService {
  private readonly api = inject(ApiService);
  private readonly builder = inject(ActionBuilderService);
  private readonly location = inject(LocationService);
  private readonly signatureHelper = inject(SignatureService);
  private readonly delivery = inject(DeliveryStore);

  async checkIn(input: CheckInInput): Promise<void> {
    const refnumber = this.delivery.stopId();
    if (!refnumber) {
      throw new Error('No active stop selected. Open a stop from the Delivery list first.');
    }
    const coords = await this.location.tryGetCurrent();
    const timestamp = nowIsoUtc();

    // Wire payload (backend spec):
    //   refnumber, userid, utcDateTime, action='check_in', deviceId,
    //   longitude, latitude, branchid, note (optional per C1)
    // Builder auto-fills deviceId/utcDateTime/userid/batterystatus.
    // NOTE: bankid, truckid, routeid, status are intentionally omitted.
    const dto = await this.builder.build({
      action: ACTION.CHECK_IN,
      refnumber,
      branchid: input.branchId,
      note: input.note ?? null,
      utcDateTime: timestamp,
      latitude: coords ? String(coords.latitude) : null,
      longitude: coords ? String(coords.longitude) : null,
    });

    await firstValueFrom(this.api.post<unknown>('/Check_In', dto)).catch((err) => {
      // Idempotency: if the backend reports the previous action was
      // already a check_in (e.g. the user re-entered the stop or the
      // earlier success response was lost on a flaky connection),
      // treat that as success and advance to Step 2. The local state
      // gets a fresh check-in timestamp either way.
      if (isAlreadyCheckedInError(err)) return;
      throw err;
    });
    this.delivery.markCheckedIn(timestamp);
  }

  /**
   * Status step (between Scan and Sign in the stop hub). Posts the user-
   * selected status to /PostStatusByUserId.
   *
   * Wire payload (backend spec):
   *   refnumber, userid, utcDateTime, status
   * Builder adds deviceId + batterystatus too; harmless extras.
   *
   * On success, DeliveryStore.statusUpdate is set so the stepper can
   * advance to the Sign step.
   */
  async postStatus(status: DeliveryStatus): Promise<void> {
    const refnumber = this.delivery.stopId();
    if (!refnumber) {
      throw new Error('No active stop selected.');
    }
    const dto = await this.builder.build({
      refnumber,
      status,
      utcDateTime: nowIsoUtc(),
    });

    await firstValueFrom(this.api.post<unknown>('/PostStatusByUserId', dto));
    this.delivery.markStatusUpdated(status);
    this.delivery.markProcessComplete();
  }

  /**
   * Step 4 (Sign). Post the captured signature.
   *
   * Wire payload (backend spec):
   *   refnumber, signature, userid, utcDateTime, latitude, longitude, deviceId
   * Builder adds batterystatus too; harmless extra.
   *
   * NOTE: action, status, bankid, branchid, routeid, truckid are omitted.
   */
  async postSignature(signatureDataUrlOrBase64: string): Promise<void> {
    const refnumber = this.delivery.stopId();
    if (!refnumber) {
      throw new Error('No active stop selected.');
    }
    const raw = this.signatureHelper.toRawBase64(signatureDataUrlOrBase64);
    const coords = await this.location.tryGetCurrent();

    const dto = await this.builder.build({
      refnumber,
      signature: raw,
      utcDateTime: nowIsoUtc(),
      latitude: coords ? String(coords.latitude) : null,
      longitude: coords ? String(coords.longitude) : null,
    });

    await firstValueFrom(this.api.post<unknown>('/PostSignature', dto));
    this.delivery.setSignature(raw);
  }

  async checkOut(input: CheckOutInput = {}): Promise<void> {
    const refnumber = this.delivery.stopId();
    if (!refnumber) {
      throw new Error('No active stop selected.');
    }
    const coords = await this.location.tryGetCurrent();
    const timestamp = nowIsoUtc();

    // Wire payload (backend spec):
    //   refnumber, userid, utcDateTime, action='check_out', deviceId,
    //   longitude, latitude, branchid, note (optional per C1)
    // NOTE: bankid, truckid, routeid, status are intentionally omitted.
    const dto = await this.builder.build({
      action: ACTION.CHECK_OUT,
      refnumber,
      branchid: this.delivery.branchId(),
      note: input.note ?? null,
      utcDateTime: timestamp,
      latitude: coords ? String(coords.latitude) : null,
      longitude: coords ? String(coords.longitude) : null,
    });

    await firstValueFrom(this.api.post<unknown>('/check_out', dto)).catch((err) => {
      // Idempotency: backend reports "Your previous action was a check_out"
      // (HTTP 400) when the agent retries (lost response, re-entry, etc.).
      // Treat that as success — the stop is already closed server-side.
      if (isAlreadyCheckedOutError(err)) return;
      throw err;
    });
    this.delivery.markCheckedOut(timestamp);

    // Delivery complete — reset the store so the next stop starts fresh.
    this.delivery.clear();
  }
}
