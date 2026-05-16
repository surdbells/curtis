# CurTIS Project Handover

**Version**: 0.1.0 · **Build**: 10 · **As of**: Phase 8 Commit 4 complete
**Primary repo**: <https://github.com/surdbells/curtis>
**Backend API**: TrackingApi v1 — `https://bwtrackapi2.betacrest.com`

This document is the engineering handover for any developer picking up the
project. It captures the why behind each major architectural decision so
that intentions survive context churn.

---

## Contents

1. [Phase summary](#phase-summary)
2. [Architectural decisions](#architectural-decisions)
3. [Wire-format conventions](#wire-format-conventions)
4. [Stores reference](#stores-reference)
5. [Services reference](#services-reference)
6. [Interceptor chain](#interceptor-chain)
7. [Offline queue mechanics](#offline-queue-mechanics)
8. [Push notification contract](#push-notification-contract)
9. [Theme system](#theme-system)
10. [Open TODOs](#open-todos)
11. [Deployment checklist](#deployment-checklist)
12. [Known limitations](#known-limitations)

---

## Phase summary

| Phase | Scope | Commit |
|---|---|---|
| 1 | Scaffold + core infrastructure (interceptors, stores, SQLite, theme tokens) | `f3c07cc` + hotfixes |
| 2 | Auth — login, JWT refresh, biometric unlock, server logout | `2f35061` |
| 3 | Dashboard, Map (Leaflet), Day lifecycle (start/end) | `7bf0824` |
| 4 | Daily Operations — check-in/out, delivery, signature, vault | `5324344` |
| 5 / 1 | Wire-field corrections + bundled XML reference fallback | `df6ef5e` |
| 5 / 2 | Seal scanning + manual & retail evacuation | `6a08d6a` |
| 5 / 3 | Premium UI polish + dark mode | `43b0596` |
| 6 / 1 | Background GPS via foreground service + battery polling | `9f7af04` |
| 6 / 2 | Incident reporting + SOS button | `29ba890` |
| 7 / 1 | Offline drain worker — exp. backoff + dead-letter | `702c8d0` |
| 7 / 2 | Queue inspection page + tappable banner | `7b67411` |
| 7 / 3 | Push notifications — FCM/APNs + in-app banner + deep links | `25b562e` |
| 8 / 0 | API spec realignment + legacy project removal | `b9516a2` |
| 8 / 1 | Navy brand repaint + native icon/splash generation | `c96b6aa` |
| 8 / 2 | Sentry SDK + ErrorReportingService | `27c40f8` |
| 8 / 3 | Onboarding + battery-exemption + v0.1.0 | `c84b1d8` |
| 8 / 4 | Settings page + comprehensive docs | (this commit) |

---

## Architectural decisions

### Standalone components, no NgModules

Angular 20's standalone API is the project default. Every feature page
declares its own `imports` and is lazy-loaded via `loadComponent`. There
is exactly **one** application configuration object (`app.config.ts`)
that provides cross-cutting concerns.

Why: simpler mental model, smaller bundles per route, no `app.module.ts`
to keep in sync with feature additions.

### Signal-based stores, not NgRx

Each domain owns a tiny `@Injectable({ providedIn: 'root' })` store with:
- private `signal<T>()`s for state
- `readonly` `.asReadonly()` accessors for consumers
- `computed()` derivations
- a small set of mutators (`setSession`, `clear`, etc)

Why: signals are first-class in Angular 20. No reducer boilerplate, no
RxJS gymnastics, full type safety. The whole project ships without a
single NgRx import.

### Action-builder pattern for POSTs

Every POST body is assembled via `ActionBuilderService.build({…})`. It:
1. Fills the canonical `DevicePostDto` (deviceId, userId, lat/lng, mileage, gas, battery, utcDateTime)
2. Pulls volatile fields fresh per call (device battery level, GPS coords)
3. Applies the **wire-name translation** before returning (see below)

Why: a single point that ensures every post is well-formed; tests can
focus on this one service rather than dozens of feature services.

### Wire-name translation (camelCase → legacy field names)

The OpenAPI spec describes the schema in camelCase, but the production
server inherited some Pascal/all-lowercase field names from the legacy
Android client:

| Schema (camelCase) | Wire (legacy) |
|---|---|
| `utcDateTime` | `DateTime` |
| `batterystatus` | `batterylevel` |

The translation lives in `ActionBuilderService` as a `WIRE_FIELD_NAMES`
map. If the server is ever updated to accept camelCase, removing two
entries from this map switches behaviour — feature code stays unchanged.

### Offline-first via interceptor

The `offline` interceptor is the second-to-last in the chain. On any
network failure it:
1. Enqueues the request body + URL + headers + an idempotency key into SQLite
2. Synthesises a `202 Accepted` so the caller can finish its UI flow
3. Lets the drain worker replay it later

Why: feature code never has to branch on "am I online?" — POSTs always
appear to succeed. The offline banner + queue page handle UX.

### Reference cache + bundled XML fallback

For static-ish lookups (banks, branches, retailers) the order is:
1. **Cache** — SQLite `reference_cache` table; stale-while-revalidate
2. **API** — live fetch; populates cache on 2xx
3. **XML fallback** — bundled manifests in `src/assets/data/`

The XML files are last-resort only. They never override a successful API
response — so production data drift won't break the app.

---

## Wire-format conventions

### Date/time

All `utcDateTime` values are **ISO 8601 UTC** with milliseconds:
```
2026-04-21T08:15:00.000Z
```

`nowIsoUtc()` in `core/utils/date.util.ts` is the only sanctioned producer.

### Action enum

Every POST has an `action` string from `core/models/actions.model.ts`:
```ts
ACTION.START_DAY            // 'start_day'
ACTION.END_DAY              // 'end_day'
ACTION.CHECK_IN             // 'check_in'
ACTION.CHECK_OUT            // 'check_out'
ACTION.PROCESS              // 'process'
ACTION.SIGNATURE            // 'signature'
ACTION.STATUS_BEAT          // 'status_beat'
ACTION.MANUAL_EVACUATION    // 'manual_evacuation'
ACTION.EVACUATION_RECEIPT   // 'evacuation_receipt'
ACTION.INCOMING_SEALS_ROUTE // 'incoming_seals_route'
ACTION.INCOMING_SEALS_BANK  // 'incoming_seals_bank'
ACTION.INCIDENT             // 'incident'
ACTION.GPS_PING             // 'gps_ping'
```

### Status enum

```ts
STATUS.OK       // 'ok'
STATUS.INCIDENT // 'incident'
```

### Seals serialisation

Seal IDs are joined with comma: `"sealA,sealB,sealC"`. Implemented in
`SealService.serialiseSealIds`. No JSON, no array — comma-separated only.

### API response envelope

```ts
{
  status: "0",      // "0" = success; anything else = failure
  message: string,
  data: T | null
}
```

Use `isApiSuccess(res)` helper (in `models/api-response.model.ts`) at
every consumer site — never inspect `status` directly.

### JWT specifics

- Algorithm: **HS256**
- Lifetime: ~30 minutes
- `expiresAt`: ISO 8601 UTC string returned alongside the token

The refresh interceptor proactively refreshes when fewer than
`tokenRefreshThresholdSec` (default 60s) remain.

---

## Stores reference

| Store | Owns |
|---|---|
| `SessionStore` | user, accessToken, refreshToken, expiresAt, isAuthenticated computed |
| `DayStore` | dayActive, dayStartedAt, truckId, routeId, mileage, gas |
| `TruckStore` | current truck (loaded once per shift) |
| `RouteStore` | current route + stops |
| `DeliveryStore` | per-stop state during the operations flow |

All five live in `src/app/core/stores/`. All are `providedIn: 'root'`
singletons.

---

## Services reference

### Auth + identity

| Service | Role |
|---|---|
| `AuthService` | login, refresh, logout, post-login persistence |
| `TokenService` | hydrate session from preferences, persist new tokens, biometric credential storage |
| `BiometricService` | wrapper around `@capgo/capacitor-native-biometric` |

### Day + operations

| Service | Role |
|---|---|
| `DayService` | start/end day POSTs |
| `DeliveryService` | check-in/out, signature submission |
| `EvacuationService` | manual + retail evacuation POSTs |
| `SealService` | bank/route seal fetches + posts |
| `StatusService` | `/PostStatusByUserId` — also used by incident reporting |
| `IncidentService` | incident submission + photo capture |
| `SignatureService` | base64 PNG → `/PostSignature` |

### Reference data

| Service | Role |
|---|---|
| `RouteService` | `/GetRoute*` — current agent's route |
| `TruckService` | `/GetTruck*` |
| `BankService` | banks + branches + clients |
| `RetailerService` | bundled XML retailer manifest |
| `XmlLoaderService` | shared XML parser via `fast-xml-parser` |
| `ReferenceCacheService` | SQLite-backed key/value cache |

### Infrastructure

| Service | Role |
|---|---|
| `ApiService` | thin HttpClient wrapper that auto-prefixes base URL + parses envelope |
| `ConfigService` | env config + runtime overrides (GPS interval) |
| `StorageService` | SQLite open + schema migration |
| `OfflineQueueService` | drain worker, queue inspection API |
| `ConnectivityService` | online/offline signal |
| `BatteryService` | 60s poll of `Device.getBatteryInfo()` |
| `TrackerService` | foreground-service GPS pings every N seconds |
| `LocationService` | one-shot `Geolocation.getCurrentPosition` wrapper |
| `DeviceService` | cached `Device.getInfo` + `Device.getId` + battery |
| `IpLookupService` | best-effort public IP for login payload |
| `PushService` | FCM/APNs registration + payload parsing + deep-link routing |
| `OnboardingService` | versioned one-time onboarding state |
| `ThemeService` | system/light/dark with override + status-bar sync |
| `ErrorReportingService` | Sentry facade (no-op when DSN empty) |
| `ScannerService` | continuous-mode barcode scanning |
| `CameraService` | photo capture for incidents |
| `ActionBuilderService` | the canonical POST body builder |

---

## Interceptor chain

Order is critical. Defined in `core/interceptors/index.ts`:

```
Request flow:    feature → jwt → refresh → offline → error → Backend
Response flow:   Backend → error → offline → refresh → jwt → feature
```

1. **jwt** — attaches `Authorization: Bearer <token>` to every API request
2. **refresh** — catches 401, single-flights `/refresh`, replays the original
3. **offline** — on `HttpErrorResponse(status=0)` → enqueue to SQLite → synth 202
4. **error** — logging tail (NOT capture — Sentry's auto-handler does that)

---

## Offline queue mechanics

**Table**: `queued_requests` in SQLite. Schema added in Phase 1, migrated
in Phase 7/1 to include `next_attempt_at` + `status` columns.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | autoincrement |
| `url` | TEXT | full URL or relative path |
| `body` | TEXT | JSON-serialised body |
| `idempotencyKey` | TEXT UNIQUE | UUID v4 from `idempotency-key.util` |
| `createdAt` | TEXT | ISO 8601 UTC |
| `retry_count` | INTEGER | starts at 0 |
| `last_attempt_at` | TEXT NULLABLE | |
| `last_error` | TEXT NULLABLE | first 240 chars of error message |
| `next_attempt_at` | TEXT NULLABLE | NULL when dead-lettered |
| `status` | TEXT | `'pending'` or `'dead_letter'` |

**Triggers**: network reconnect, App.appStateChange isActive, 60s timer,
initial bootstrap kick.

**Backoff schedule** (in seconds, step per retry): 1, 2, 4, 8, 16, 32, 60
(capped at 60s after step 6). MAX_RETRIES = 10 → dead-letter.

**Public API** (`OfflineQueueService`):
- `enqueue(req)` — interceptor calls this
- `drain()` — kicks the worker manually
- `refreshCount()` — refresh `pendingCount`/`deadLetterCount` signals
- `list()` — return all rows (queue page)
- `retryRow(id)` — reset `retry_count` and `next_attempt_at`
- `discardRow(id)` — DELETE
- `clearAll()` — DELETE all

**Reactive signals**: `pendingCount`, `deadLetterCount`, `draining`.

**Dead-letter capture**: when `retry_count >= MAX_RETRIES`, the worker
calls `ErrorReportingService.captureMessage` so dispatch can investigate.

---

## Push notification contract

`src/app/core/models/push.model.ts` defines four categories:

| Category | Default deep link | Extension fields |
|---|---|---|
| `route_changed` | `/map` | `routeId` |
| `dispatch_message` | `/dashboard` | `sender`, `priority` ('normal'/'urgent') |
| `sos_acknowledged` | `/dashboard` | `incidentId` |
| `system` | `/dashboard` | `systemAction` ('force_logout'/'maintenance'/'update_available') |

**Wire shape** (FCM `data` field; APNs custom data):

```json
{
  "category": "route_changed",
  "title": "Route reassigned",
  "body": "Your shift now covers Lekki Phase 1 → Ikoyi.",
  "route": "/map",
  "routeId": "abc-123"
}
```

Optional override fields: `route` (explicit deep link), `actionId`
(analytics tag).

**System actions**: when `systemAction === 'force_logout'`, the
`PushService` immediately routes to `/login` with `replaceUrl`. Other
system actions are informational only.

---

## Theme system

Three-state preference: `'system'` / `'light'` / `'dark'`.
Persisted under `curtis.theme.preference` in `@capacitor/preferences`.

**How override works**:
- `'system'`: no extra class on `<html>`; `prefers-color-scheme` media query in `theme/variables.scss` drives the palette.
- `'light'`: `<html class="curtis-force-light">` is added; light tokens are already the default so no override block is needed.
- `'dark'`: `<html class="curtis-force-dark">` is added; `global.scss` re-declares the dark tokens inside `html.curtis-force-dark, html.curtis-force-dark body` with class specificity higher than the media-query rules.

**Status-bar sync**: `ThemeService.syncStatusBar` calls
`StatusBar.setStyle({ style: Style.Dark | Style.Light })` on native
platforms so the system icons remain legible.

---

## Open TODOs

These are flagged in code with `TODO(...)` comments. Search the repo to
find each call site.

### 1. `POST /RegisterPushToken` endpoint shape — `PushService.maybeSendTokenToBackend`

The intended payload is:
```ts
POST /RegisterPushToken
{ userid, token, platform: 'android'|'ios', appId: 'ViewHot' }
```

Currently the code logs the intent and stores a `userId::token` marker
in Preferences so registration isn't re-attempted on every launch. Two
lines in `PushService.maybeSendTokenToBackend()` are commented out;
uncomment when the endpoint is confirmed.

### 2. JWT refresh endpoint shape — `AuthService.refresh`

The current assumption: `POST /refresh { token, refreshToken }`. The
new OpenAPI spec defines `/login` and `/logout` but no explicit refresh
endpoint — likely a custom non-OpenAPI route on the legacy server.
Confirm with backend; if different, adjust `AuthService.refresh` only.

### 3. Sentry DSN per environment

Sentry is wired (`@sentry/angular`) and the global error handler is
installed, but `sentryDsn` is empty in every env file. Activate by
pasting the project DSN from `sentry.io` into the matching
`environment.*.ts` file.

### 4. Sample response bodies for reference endpoints

`/GetRouteByUserId`, `/GetTruck*`, `/GetBanks`, `/GetIncomingSeals*`
all currently use TypeScript interfaces with index signatures because
the OpenAPI spec marks their response schemas as `OK` without a body
shape. Once real sample bodies are available, tighten:
- `core/models/route.model.ts` → `Route` + `RouteStop`
- `core/models/truck.model.ts` → `Truck`
- `core/models/bank.model.ts` → `Bank`, `Branch`
- `core/models/seal.model.ts` → `IncomingSeal`

### 5. Asset source images for foreground/background

The `assets/icon-foreground.png` (transparent bg, 62% safe-zone) and
`assets/icon-background.png` (solid navy) are committed but a designer
should sign off on the safe-zone framing for the adaptive icon. See
README → Asset generation.

---

## Deployment checklist

Use this for every release.

### Pre-flight

- [ ] Sentry DSN set in `environment.prod.ts` and `environment.staging.ts`
- [ ] `package.json` version bumped (semver)
- [ ] `android/app/build.gradle` `versionCode` (+1) and `versionName` synced
- [ ] `ios/App/App.xcodeproj/project.pbxproj` `CURRENT_PROJECT_VERSION` and `MARKETING_VERSION` synced
- [ ] `environment.prod.ts` and `environment.staging.ts` `sentryRelease` updated to match
- [ ] All four version tags identical (`grep -rE '0\.\d+\.\d+' package.json android/app/build.gradle ios/App/App.xcodeproj/project.pbxproj src/environments`)
- [ ] `QA-CHECKLIST.md` walked through on a staging device

### Build

- [ ] `npm install` against the locked `package-lock.json` succeeds clean
- [ ] `npx tsc --noEmit -p tsconfig.app.json` → 0 errors
- [ ] `npx ng build --configuration=production` → 0 errors / 0 warnings
- [ ] `npx cap sync` → clean

### Android

- [ ] AAB built with release keystore (Android Studio → Generate Signed Bundle)
- [ ] AAB uploaded to Play Console internal testing
- [ ] Smoke test on a release-track device

### iOS

- [ ] Archive built in Xcode (Product → Archive)
- [ ] Uploaded to App Store Connect via Xcode Organizer
- [ ] TestFlight smoke test

### Post-release

- [ ] Tag the git commit: `git tag v0.X.Y && git push --tags`
- [ ] Sentry release created (if DSN active) — happens automatically via the release string
- [ ] Update `CHANGELOG.md` (if/when introduced)

---

## Known limitations

| Area | Limitation |
|---|---|
| Web platform | Background tracking and biometric services are no-ops; the web build is for dev iteration only |
| iOS background | Background GPS uses the `location` background mode; iOS may still throttle if it detects the agent isn't moving for prolonged periods |
| Android API levels | `READ_MEDIA_IMAGES` granular permission requires API 33+ (handled via Photo Picker backport metadata for 30-32) |
| Offline auth | The agent cannot log in offline. Once authenticated, the JWT works offline until expiry; biometric unlock requires the JWT to be valid |
| SQLite web shim | `sql.js` adds ~700 KB to the web bundle; this cost is only borne by the dev web build, not native APK/IPA sizes |
| Sentry tracing | Currently no custom transaction spans; only automatic route-change transactions. Add `Sentry.startSpan` wrappers in feature services if more granularity is needed later |
| Push token rotation | Backend POST is gated on the `/RegisterPushToken` endpoint TODO above |

---

**End of handover.** For phase-by-phase commit history with rationale,
read each commit message — they are deliberately verbose. The repo's
`git log --oneline` is a complete project history in itself.
