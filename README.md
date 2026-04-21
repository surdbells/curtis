# CurTIS Client

Cash-in-Transit (CIT) field operations app for security courier agents.

Ionic 8 + Angular 20 + Capacitor 8. Android + iOS. Offline-first, biometric unlock, continuous GPS tracking during active day, QR/barcode seal scanning, signature and receipt capture, push notifications.

This is the **Phase 1** scaffold. See [Phase status](#phase-status) below.

---

## Stack

| Concern            | Choice                                                            |
|--------------------|-------------------------------------------------------------------|
| Framework          | Ionic 8 + Angular 20 (standalone components, signals, new control flow) |
| Native bridge      | Capacitor 8                                                       |
| Auth               | JWT access token + refresh token (persisted via @capacitor/preferences) |
| HTTP               | Angular HttpClient + interceptor chain (jwt → refresh → offline → error) |
| Local DB           | @capacitor-community/sqlite (with jeep-sqlite web fallback)       |
| Foreground GPS     | @capacitor/geolocation                                            |
| Background GPS     | @capacitor-community/background-geolocation                       |
| Camera             | @capacitor/camera                                                 |
| QR / barcode       | @capacitor-mlkit/barcode-scanning                                 |
| Signature          | signature_pad (upstream library, wrapped in a standalone component) |
| Biometrics         | @capgo/capacitor-native-biometric                                 |
| Push               | @capacitor/push-notifications (FCM / APNs)                        |
| Maps               | Leaflet + OpenStreetMap                                           |
| Connectivity       | @capacitor/network                                                |
| State              | Signal-based stores (no RxJS state layer, no NgRx)                |

---

## Prerequisites

- Node.js 20+ and npm 10+
- Ionic CLI: `npm i -g @ionic/cli`
- Android: Android Studio (Hedgehog or newer), JDK 17, Android SDK 34
- iOS: macOS with Xcode 15+, CocoaPods (`sudo gem install cocoapods`)

---

## Getting started

```bash
# Install dependencies
npm install

# Run in the browser (for quick dev iteration; native plugins stub out)
npm start

# Build
npx ng build --configuration=development
npx ng build --configuration=staging
npx ng build --configuration=production

# Sync web output into native projects
npx cap sync

# Open native IDEs
npx cap open android
npx cap open ios    # macOS only, requires `pod install` in ios/App first time
```

---

## Environments

Three configurations in `src/environments/`:

| File                     | Used by               | `env` | Notes                           |
|--------------------------|-----------------------|-------|---------------------------------|
| `environment.ts`         | default / development | `dev` | Points at prod API for now      |
| `environment.staging.ts` | staging build         | `staging` | Update URL when staging exists |
| `environment.prod.ts`    | production build      | `prod` |                                 |

Build configurations are wired up in `angular.json` via `fileReplacements`.

---

## Architecture

```
src/app/
├── core/
│   ├── models/         # DTOs and domain types (incl. DevicePostDto, ApiResponse<T>)
│   ├── stores/         # signal-based SessionStore, DayStore, RouteStore
│   ├── services/       # api, auth, token, device, location, tracker, camera,
│   │                   # scanner, biometric, signature, push, storage,
│   │                   # offline-queue, connectivity, xml-loader, config
│   ├── interceptors/   # jwt, refresh, offline, error (composed in order)
│   ├── guards/         # authGuard, dayStartedGuard
│   ├── utils/          # jwt decode, time helpers
│   └── app-initializer # bootstrap sequence (connectivity → storage → tokens)
├── shared/components/  # offline-banner, loading-overlay, scan-button,
│                       # seal-list, signature-pad
├── features/
│   ├── auth/           # splash, login, biometric-unlock
│   ├── dashboard/      # operational hub (tile grid)
│   ├── map/            # Leaflet route view
│   ├── daily/          # today's stops
│   ├── delivery/ process/ signature/
│   ├── manual-evacuation/ retail-evacuation/
│   ├── route-scan/ bank-scan/
│   └── incident/
├── app.component.ts    # ion-app + ion-router-outlet
├── app.config.ts       # standalone bootstrap providers
└── app.routes.ts       # lazy-loaded routes with guards
```

The whole app bootstraps in `main.ts` — no NgModule.

### ApiResponse envelope

Every TrackingApi endpoint wraps its payload:

```json
{ "status": "0", "message": "...", "data": { ... } }
```

`status === "0"` is success. `ApiService.unwrap()` returns `data` directly, or throws the envelope for the error interceptor.

### HTTP interceptor chain

Composed in `core/interceptors/index.ts` in order:

1. **jwt** — attach `Authorization: Bearer <token>` to API requests (skipping `/login` and `/refresh`)
2. **refresh** — catch `401`, call `/refresh`, replay with new token. Single-flight — concurrent 401s wait for the first to complete.
3. **offline** — on network error or known-offline dispatch, persist the POST to SQLite and synthesise a `202 Accepted` so the UI continues
4. **error** — logging tail

### Signal-based stores

Three stores replace the classic RxJS service pattern:

- **SessionStore** — authenticated user + tokens (mirrors persisted state)
- **DayStore** — day active flag, start timestamp, truck, route
- **RouteStore** — active route + current stop index

All reactive via Angular signals (`user()`, `isAuthenticated()`, `dayActive()`, etc.).

### Offline queue

`StorageService` opens a SQLite database at bootstrap (`curtis_local`). One table so far:

```sql
CREATE TABLE queued_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  method TEXT, url TEXT, body TEXT,
  created_at TEXT, last_attempt_at TEXT,
  retry_count INTEGER DEFAULT 0, last_error TEXT,
  idempotency_key TEXT UNIQUE
);
```

Enqueue is wired today. Replay with exponential backoff lands in Phase 7.

---

## Phase status

| Phase | Scope | Status |
|-------|-------|--------|
| 0 — Discovery | Backend confirmations | Partially answered (see [Open questions](#open-questions)) |
| **1 — Scaffold & core infrastructure** | Project setup, models, stores, services, interceptors, guards, placeholder pages | **✅ Done (this commit)** |
| 2 — Auth | Real login, biometric unlock, refresh | ⏳ Next |
| 3 — Dashboard & Map & Day lifecycle | Leaflet, start/end day, truck/route fetch | ⏳ |
| 4 — Daily Operations | Delivery, process, signature, check-in/out, status beats | ⏳ |
| 5 — Evacuation, Seal scanning, Camera | QR scan, manual/retail evacuation, XML assets | ⏳ |
| 6 — Background GPS & Incidents | Background tracker, incident reporting, panic button | ⏳ |
| 7 — Offline queue & Push | Queue replay, FCM token registration, deep-links | ⏳ |
| 8 — Polish & QA | Icons, signing, device testing | ⏳ |

---

## Open questions

Phase 0 items still pending confirmation from the backend team. These are marked throughout the code with `TODO(phase-0)`:

1. **Refresh token endpoint.** The `/login` response includes a `refreshToken` but the OpenAPI spec does not document a refresh route. Current assumption in `AuthService.refresh()`: `POST /refresh` with `{ token, refreshToken }` returning the same shape as `/login`.
2. **`userid` in `DevicePostDto`.** Assumed client-sent from decoded JWT `sub`. If backend derives from token, we can drop it — harmless to send either way.
3. **Required fields per POST action.** Which subset of `DevicePostDto` is required for each endpoint (`start_day`, `Check_In`, `PostSignature`, etc.).
4. **Seals payload format.** Comma-separated IDs, JSON string, or one-request-per-seal.
5. **Photo/signature encoding.** Assumed base64 without data-URL prefix; to be confirmed against backend parser.
6. **Error response shape.** Assumed `{ status, message, data? }` with `status !== "0"` on failure.
7. **FCM token registration endpoint.** Not in the OpenAPI spec — may need to be added.
8. **Sample response bodies** for `GetRouteByUserId`, `GetTruckByUserId`, `GetClients`, `GetBanks`, `GetBranchesByState`, `GetIncomingSealsBy{Route|Bank}`. Models in `core/models/` are skeletons until these land.
9. **`GetConfig` endpoint** (referenced in the prior NativeScript plan) — confirm whether one exists or the base URL / client config is static.

---

## Security notes

- Fine-grained PATs were used to push the initial commit — revoke them after use.
- Auth tokens are currently stored in `@capacitor/preferences` (UserDefaults on iOS, SharedPreferences on Android). For a CIT app this is acceptable for MVP but should be upgraded to a Keystore/Keychain-backed store before production rollout. Tracked in `TokenService` as `TODO(security-hardening)`.
- Android manifest requests `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` so the background GPS service stays alive. Phase 8 will surface the prompt to the user on first active-day start.
- iOS background modes are declared (`location`, `fetch`, `remote-notification`). Apple review will require a clear justification of the always-on location permission in the submission notes.
- No cleartext traffic is allowed (`NSAllowsArbitraryLoads=false`, `android:usesCleartextTraffic` implicit default).

---

## Known stubs

These are intentionally incomplete in Phase 1 and will fill in over subsequent phases:

- `TrackerService.start()` / `.stop()` — method bodies are empty until Phase 6
- `OfflineQueueService.drain()` — replay loop deferred to Phase 7
- `XmlLoaderService` — asset files under `src/assets/data/*.xml` are empty placeholders until the legacy XML manifests are pulled from the old Android project
- `LoginPage.submit()` — logs only; Phase 2 wires `AuthService.login`
- Feature pages beyond `dashboard` are placeholder shells with the target route structure

---

## License

Proprietary — © Kodek Innovations Limited.
