# CurTIS — Currency Tracking and Information System

Cash-in-Transit (CIT) field operations app for currency courier agents.
Cross-platform mobile app built on Ionic 8 + Angular 20 + Capacitor 8,
targeting Android and iOS from a single TypeScript codebase.

CurTIS replaces a legacy native Android app (`CurtisTracker`) and adds
cross-platform support, modernised architecture, offline-safe queueing,
real-time push notifications, and background GPS tracking.

**Repo**: <https://github.com/surdbells/curtis>
**Backend API**: TrackingApi v1 — <https://bwtrackapi2.betacrest.com>
**Version**: 0.1.0 (build 10) — first release-candidate

---

## Contents

1. [What it does](#what-it-does)
2. [Tech stack](#tech-stack)
3. [Architecture at a glance](#architecture-at-a-glance)
4. [Getting started](#getting-started)
5. [Project structure](#project-structure)
6. [Environment configuration](#environment-configuration)
7. [Build & run](#build--run)
8. [Release builds](#release-builds)
9. [Signing](#signing)
10. [Asset generation](#asset-generation)
11. [Troubleshooting](#troubleshooting)
12. [License](#license)

---

## What it does

A CIT agent's complete shift is supported end-to-end:

| Phase                  | Capability |
|------------------------|------------|
| Authentication         | Username/password login, biometric unlock for re-entry, JWT refresh, server logout |
| Onboarding (one-time)  | Welcome + Android battery-exemption guidance |
| Dashboard              | Truck/route summary, day controls, tile-grid navigation, SOS button |
| Map                    | Live route stops with current GPS position |
| Day lifecycle          | Start day → Check-in/out at stops → End day, with mileage & gas readings |
| Daily Operations       | Bank/branch delivery flows, signature capture, vault status |
| Evacuation             | Manual evacuation, retail evacuation receipts, full sealed-bag tracking |
| Seal scanning          | Bank-scan and route-scan flows with bulk processing |
| Incidents              | In-shift incident reporting and SOS (pre-shift or in-shift) |
| Background tracking    | Foreground-service GPS pings every N seconds while a day is active |
| Offline replay         | All POSTs queue to SQLite when offline; auto-drain on reconnect with exponential backoff |
| Push notifications     | Route changes, dispatch messages, SOS acks, system messages — all deep-link routed |
| Settings               | Theme override, GPS interval, push status, diagnostics, log-out |

---

## Tech stack

**Frontend (Angular 20 + Ionic 8 standalone)**
- Angular 20 — standalone components, signals, new `@if`/`@for` control flow
- Ionic 8 — UI components, theming, route reuse strategy
- Zone.js — change detection (zoneless deferred; pinned because of MLKit barcode plugin)
- Reactive state via signals + small per-feature stores (no NgRx)

**Native runtime (Capacitor 8)**

| Plugin | Purpose |
|---|---|
| `@capacitor/app` | App-state lifecycle (foreground/background), back-button |
| `@capacitor/app-launcher` | Open Android battery-optimisation settings intent |
| `@capacitor/camera` | Photo capture for incident reports |
| `@capacitor/device` | Device ID, OS version, battery info |
| `@capacitor/geolocation` | Foreground location reads |
| `@capacitor/haptics` | Touch feedback throughout the app |
| `@capacitor/keyboard` | Keyboard show/hide handling |
| `@capacitor/network` | Connectivity signal |
| `@capacitor/preferences` | Persisted key/value (auth, onboarding, theme prefs) |
| `@capacitor/push-notifications` | FCM/APNs registration + delivery |
| `@capacitor/splash-screen` | Native launch splash |
| `@capacitor/status-bar` | Status-bar style sync with theme |
| `@capacitor-community/background-geolocation` | Foreground-service GPS while day active |
| `@capacitor-community/sqlite` | Offline queue + reference cache |
| `@capacitor-mlkit/barcode-scanning` | Continuous-mode QR/barcode scanning |
| `@capgo/capacitor-native-biometric` | Fingerprint/Face ID re-entry |
| `@capacitor/assets` | Source-to-platform icon + splash generator |

**Web stack**
- Leaflet + OpenStreetMap tiles (map)
- signature_pad (signature capture)
- fast-xml-parser (legacy XML reference fallback)
- jeep-sqlite + sql.js (SQLite web shim for browser dev)
- @sentry/angular (error reporting; no-op until DSN configured)

---

## Architecture at a glance

```
┌─────────────────────────────────────────────────────────┐
│  UI: Features  (lazy-loaded standalone pages)           │
│   dashboard · map · daily · delivery · ...              │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Stores  (signal-based)                                 │
│   SessionStore · DayStore · RouteStore · DeliveryStore  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Services  (Auth · Tracker · Push · Offline-Queue · …)  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  HTTP Interceptor chain                                 │
│   1. jwt       — attach Bearer token                    │
│   2. refresh   — 401 catch, single-flight /refresh      │
│   3. offline   — enqueue to SQLite + synth 202 Accepted │
│   4. error     — logging tail                           │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
              TrackingApi v1 backend
```

**Key architectural decisions**

- **Standalone components**, no `NgModule`s — every feature page declares its own imports.
- **Signal stores** rather than NgRx — small, type-safe, no boilerplate. Each store owns one slice (session, day, route, etc).
- **Action-builder pattern** — every POST goes through `ActionBuilderService` which assembles the canonical `DevicePostDto` (deviceId, utcDateTime, lat/lng, battery, etc) and applies the wire-name translation (legacy server expects `DateTime`/`batterylevel`, not the camelCase OpenAPI names).
- **Offline-first** — every POST passes through the offline interceptor. Network failure ⇒ enqueue to SQLite ⇒ synth a 202. The drain worker replays on reconnect / app resume / 60s timer with exponential backoff.
- **Reference cache**: bank/branch/retailer lists cached in SQLite. Stale-while-revalidate: serve cache, fetch fresh in background, fall back to bundled XML manifests only when both fail.
- **Foreground service for GPS**: `@capacitor-community/background-geolocation` keeps the location service alive with a persistent notification while a day is active. The Android battery-optimisation exemption is surfaced in onboarding because Doze mode will otherwise kill the service.
- **Sentry** is wired but disabled by default — set a DSN per environment to activate.

---

## Getting started

### Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | ≥ 20.0 | LTS recommended |
| npm | ≥ 10.0 | bundled with Node 20 |
| Xcode | ≥ 15 | iOS builds + simulator (macOS only) |
| Android Studio | Hedgehog (2023.1.1) or later | SDK 34 + NDK |
| Java | 17 | required by Android Gradle Plugin 8 |
| CocoaPods | ≥ 1.13 | iOS pod install |

### Clone and install

```bash
git clone https://github.com/surdbells/curtis.git
cd curtis
npm install
```

### Verify the toolchain

```bash
npx ng version          # Angular CLI 20
npx cap doctor          # Capacitor environment check
```

---

## Project structure

```
curtis/
├── src/
│   ├── app/
│   │   ├── core/                  # framework-free building blocks
│   │   │   ├── guards/            # authGuard, dayStartedGuard
│   │   │   ├── interceptors/      # jwt / refresh / offline / error
│   │   │   ├── models/            # TS types matching TrackingApi v1
│   │   │   ├── services/          # auth, tracker, push, queue, etc.
│   │   │   ├── stores/            # session, day, route, delivery, …
│   │   │   └── utils/             # date, jwt, idempotency-key, …
│   │   ├── features/              # lazy-loaded standalone pages
│   │   ├── shared/                # cross-feature components
│   │   ├── app.component.ts
│   │   ├── app.config.ts
│   │   └── app.routes.ts
│   ├── assets/
│   │   ├── brand/                 # logo + wordmark (source-of-truth)
│   │   └── data/                  # XML reference manifests (offline fallback)
│   ├── environments/              # dev / staging / prod env files
│   ├── theme/variables.scss       # design tokens (navy + gold palette)
│   ├── global.scss
│   ├── main.ts                    # Sentry init + bootstrap
│   └── index.html
├── android/                       # Capacitor Android project (Gradle)
├── ios/                           # Capacitor iOS project (Xcode)
├── assets/                        # @capacitor/assets staging source images
├── docs/
│   ├── api-spec-v1.json           # TrackingApi v1 OpenAPI spec
│   ├── HANDOVER.md                # phase-by-phase architectural summary
│   └── QA-CHECKLIST.md            # manual test plan
├── capacitor.config.ts
├── ionic.config.json
└── package.json
```

---

## Environment configuration

Three env files under `src/environments/`:

| File | `production` | `env` | `sentryTracesSampleRate` |
|---|---|---|---|
| `environment.ts` | false | `'dev'` | 0 |
| `environment.staging.ts` | false | `'staging'` | 0.25 |
| `environment.prod.ts` | true | `'prod'` | 0.1 |

**Per-env keys you'll typically edit**

```ts
apiBaseUrl: 'https://bwtrackapi2.betacrest.com',
appId: 'ViewHot',
tokenRefreshThresholdSec: 60,
gpsPingIntervalMs: 30_000,
offlineQueueMaxRetries: 10,
mapTileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
sentryDsn: '',                             // ← paste your DSN here
sentryTracesSampleRate: 0.1,
sentryRelease: 'curtis@0.1.0+prod',
```

When `sentryDsn` is empty, the SDK never makes a network call. To activate:

1. Create a Sentry project (one per env).
2. Paste the DSN into the matching env file.
3. Bump `sentryRelease` on each release for grouping.

---

## Build & run

### Web (browser, fastest iteration)

```bash
npm start             # serves on http://localhost:4200 (dev env)
```

### Android (real device or emulator)

```bash
npx ng build                       # build web bundle
npx cap sync android               # copy + update plugins
npx cap run android                # launch on connected device/emulator
# or
npx cap open android               # open the Gradle project in Android Studio
```

### iOS (macOS only)

```bash
npx ng build
npx cap sync ios
cd ios/App && pod install && cd ../..
npx cap run ios                    # launches in iOS Simulator
# or
npx cap open ios                   # open the workspace in Xcode
```

### Build configurations

```bash
npx ng build                                     # dev
npx ng build --configuration=staging             # staging env
npx ng build --configuration=production          # prod env
```

The Angular CLI does file replacement automatically: `environment.ts` is swapped for `environment.{staging|prod}.ts` per the `fileReplacements` block in `angular.json`.

---

## Release builds

### Android release APK / AAB

1. **Bump versions** in three places (they must stay in sync):
   - `package.json` — `version: "0.2.0"` (or whatever the next release is)
   - `android/app/build.gradle` — `versionCode 11` (+1 per release), `versionName "0.2.0"`
   - `src/environments/environment.prod.ts` — `sentryRelease: 'curtis@0.2.0+prod'`
2. **Build the production web bundle**:
   ```bash
   npx ng build --configuration=production
   npx cap sync android
   ```
3. **Build signed AAB in Android Studio**:
   - Open `android/` in Android Studio
   - Build → Generate Signed Bundle / APK → Android App Bundle
   - Select your release keystore (see [Signing](#signing) below)
   - Output: `android/app/release/app-release.aab`
4. **Upload to Google Play Console** as an internal-testing release first.

### iOS release IPA

1. **Bump versions**:
   - `package.json`
   - `ios/App/App.xcodeproj/project.pbxproj` — `MARKETING_VERSION = 0.2.0;`, `CURRENT_PROJECT_VERSION = 11;`
   - `src/environments/environment.prod.ts` — `sentryRelease: 'curtis@0.2.0+prod'`
2. **Build and archive**:
   ```bash
   npx ng build --configuration=production
   npx cap sync ios
   npx cap open ios
   ```
3. **In Xcode**: Product → Archive → Distribute App → App Store Connect.

---

## Signing

**Do not commit signing keystores or provisioning profiles to the repo.**
They are listed in `.gitignore` for both platforms.

### Android keystore (one-time)

```bash
keytool -genkey -v \
  -keystore curtis-release.keystore \
  -alias curtis-release \
  -keyalg RSA -keysize 2048 -validity 10000
```

Store the keystore + passwords in a secure location (Vault, 1Password, etc).
Configure Android Studio's release signing config to reference this keystore.

### iOS signing

Apple Developer Program membership required. Provisioning profile + signing certificate is configured via Xcode → Project → Signing & Capabilities. CurTIS uses automatic signing in development; for App Store distribution use a Distribution Certificate.

---

## Asset generation

App icons and splash screens are generated from a single 1024×1024 source via `@capacitor/assets`. If you replace `src/assets/brand/curtis-logo.png`:

1. Rebuild the staging assets:
   ```bash
   # Stage the source images @capacitor/assets expects
   cp src/assets/brand/curtis-logo.png assets/icon.png
   cp src/assets/brand/curtis-logo.png assets/splash.png
   cp src/assets/brand/curtis-logo.png assets/splash-dark.png
   # icon-foreground.png and icon-background.png need manual prep
   # — transparent foreground logo at 62% safe-zone scale,
   #   solid navy background. See docs/HANDOVER.md for details.
   ```
2. Regenerate all platform assets:
   ```bash
   npx capacitor-assets generate --android --ios
   ```
3. Commit the regenerated files under `android/app/src/main/res/` and `ios/App/App/Assets.xcassets/`.

---

## Troubleshooting

### Native build fails on first sync

```bash
npx cap sync             # ensure all plugins are wired
cd ios/App && pod install && cd ../..   # iOS only
```

### SQLite errors on web (browser dev)

The web platform uses `sql.js` via `jeep-sqlite`. If `sql-wasm.wasm` 404s, ensure `angular.json` `assets[]` includes `node_modules/sql.js/dist/sql-wasm.wasm`. This is wired in the current repo.

### Push notifications not arriving

1. Verify `Notifications` permission in OS settings.
2. Check Settings → Notifications → `Registered: Yes` and the token is non-empty.
3. Tap **Re-register** to retry registration.
4. Confirm FCM/APNs project credentials are configured in your backend.

### Battery service stops while screen is off (Android)

Android's Doze mode aggressively kills background services. The agent must whitelist CurTIS:
1. Settings → Battery → CurTIS → **Don't optimise** (or **Allow background activity** — wording varies).
2. Or: re-open the onboarding flow from Settings → Background activity → Show onboarding again.

### Sentry events not showing up

- Verify the DSN is pasted into the matching `environment.*.ts` file (the empty default short-circuits init).
- Check Settings → Diagnostics → `Error reporting: Active`.
- Build for that env: `npx ng build --configuration=staging` (etc).

---

## License

Proprietary. © Kodek Innovations Limited. All rights reserved.
