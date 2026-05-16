# CurTIS QA Checklist

Manual test plan covering every user-facing flow. Walk this end-to-end on
a real device (one Android, one iOS) before any release.

Sections marked **A** are Android-only; **iOS** are iOS-only; others
apply to both platforms.

**Test device baseline**
- Real device (not simulator) for any test involving GPS, push, or biometrics
- Test SIM with cellular data + WiFi network for offline testing
- Backend reachable from the device (try `https://bwtrackapi2.betacrest.com` in a browser first)
- Test agent account with: a route assigned, a truck assigned, biometric not yet enrolled

---

## 0. Install & first launch

- [ ] Fresh install completes without an error dialog
- [ ] Splash shows the navy CurTIS wordmark over the gradient (not a blank screen)
- [ ] Splash holds for ~700ms then routes to Login (not Dashboard)
- [ ] Login page: hero shows the wordmark icon tile, not the shield icon

## 1. Authentication

### 1.1 Login

- [ ] Empty fields → "Enter both username and password" toast
- [ ] Wrong password → "Incorrect username or password." toast (not stack trace)
- [ ] No network → "Network unreachable" toast
- [ ] Correct credentials → success haptic → routes to **/onboarding**
- [ ] Logging in a second time (after onboarding completed) → routes to **/dashboard** directly

### 1.2 Onboarding (first login only)

- [ ] Step 1 (Welcome) shows three info cards: tracking, offline-safe, dispatch alerts
- [ ] Step indicator dots show progress
- [ ] **A** Step 2 (Battery) appears; iOS sees only Step 1
- [ ] **A** "Open battery settings" opens the system Battery Optimisation list
- [ ] **A** If the intent fails, fallback toast appears with instructions
- [ ] "I'm ready" button on the last step → routes to **/dashboard**
- [ ] Closing and reopening the app does NOT re-trigger onboarding
- [ ] Settings → "Show onboarding again" → re-triggers the flow

### 1.3 Biometric unlock

(Requires biometric to be enrolled — currently no UI for first-time enrollment; this happens via dev tools)

- [ ] Splash with valid session + biometric available → routes to **/biometric-unlock**
- [ ] Fingerprint/Face ID prompt appears
- [ ] Cancel/fail → stays on the page; "Use password instead" link works
- [ ] Success → routes to /dashboard (or /onboarding if uncompleted)

### 1.4 Logout

- [ ] Settings → Sign out → confirm alert
- [ ] Cancel → no-op
- [ ] Confirm → routes to **/login**; TruckStore/RouteStore cleared
- [ ] Next login starts fresh (no stale dashboard data)

## 2. Dashboard

- [ ] Toolbar shows Settings cog icon (top right); tap routes to **/settings**
- [ ] **A** System back button while a day is active → minimises app (not log out)
- [ ] **A** System back button while no day is active → log-out confirm
- [ ] Truck card shows plate number; route card shows route name
- [ ] Day banner shows green-tinted gradient when day active, neutral when not
- [ ] Tile grid: Map, Daily Ops, Bank Scan, Route Scan, Manual Evac, Retail Evac, Incident, Queue all tap into their pages
- [ ] SOS FAB: pre-shift tap → routes to Incident page in SOS mode
- [ ] Connectivity badge updates correctly when toggling airplane mode
- [ ] Pull-to-refresh reloads route + truck data

## 3. Map

- [ ] Leaflet map loads with OSM tiles
- [ ] Current GPS position marker visible (blue dot)
- [ ] Route stops markers visible in order
- [ ] Route polyline connects stops, colored navy
- [ ] Tapping a stop marker shows a popup with stop name + address
- [ ] **iOS** GPS permission prompt appears on first launch

## 4. Day lifecycle

### 4.1 Start Day

- [ ] Mileage + gas inputs validate (numeric, > 0)
- [ ] Submit → POST `/start_day` fires
- [ ] Success → Dashboard day banner turns active
- [ ] Foreground service notification appears (Android: "CurTIS is tracking your route")
- [ ] **iOS** Background mode "location" indicated in status bar

### 4.2 GPS pings during shift

- [ ] Open Android logcat / Xcode console: GPS pings logged at the configured interval (default 30s)
- [ ] Pings stop when day ends
- [ ] Adjusting GPS interval in Settings changes ping rate within ~1 minute

### 4.3 End Day

- [ ] Mileage + gas inputs validate
- [ ] Submit → POST `/end_day` fires
- [ ] Foreground service notification disappears
- [ ] Dashboard day banner reverts to inactive

## 5. Daily Operations

(Requires active day)

### 5.1 Delivery — check-in

- [ ] Select a route stop → Check In page loads
- [ ] Submit → POST `/Check_In` fires
- [ ] Returns to Daily Ops with the stop marked checked-in

### 5.2 Process

- [ ] Process page lists pending items at the stop
- [ ] Submit → POST `/PostStatusByUserId` with action=process fires

### 5.3 Signature capture

- [ ] Signature pad accepts touch input
- [ ] Clear button wipes the signature
- [ ] Submit → POST `/PostSignature` with base64 PNG payload
- [ ] Empty signature → "Please sign before submitting" toast

### 5.4 Check-out

- [ ] Vault status dropdown shows correct options
- [ ] Submit → POST `/check_out` fires

### 5.5 Evacuation — Manual

- [ ] Select originating bank/branch + destination
- [ ] Add seal IDs (manual entry or scan)
- [ ] Submit → POST `/PostManualEvacuation` with comma-separated seal IDs

### 5.6 Evacuation — Retail Receipt

- [ ] Select retailer from list (sourced from API or bundled XML)
- [ ] Submit → POST `/PostEvacuationReceipt` fires

## 6. Seal scanning

### 6.1 Bank scan

- [ ] Camera opens with QR scanner overlay
- [ ] Scanning a seal QR adds it to the list
- [ ] Duplicate scan → "Already scanned" toast (no double-add)
- [ ] "Done" submits → POST `/PostIncomingSealsByBank` with `seals: "id1,id2,id3"`

### 6.2 Route scan

- [ ] Same scanning flow as bank scan
- [ ] Submit → POST `/PostIncomingSealsByRoute` fires

## 7. Incidents & SOS

- [ ] Incident page lists incident type buttons
- [ ] Selecting a type → photo capture screen
- [ ] Photo preview shown; "Retake" works
- [ ] Submit → POST `/PostStatusByUserId` with `action=incident` + `incidentytype` + base64 `image`
- [ ] SOS mode (from Dashboard FAB) → same flow but pre-fills incident type as SOS

## 8. Offline behaviour

### 8.1 Enqueue

- [ ] Enable airplane mode
- [ ] Attempt any operation (e.g. process status)
- [ ] UI shows success (synthesised 202)
- [ ] Offline banner appears at top
- [ ] Banner badge shows pending count

### 8.2 Drain

- [ ] Disable airplane mode
- [ ] Within ~5 seconds the banner badge starts decrementing
- [ ] Queue page (Settings → Sync queue or banner tap) shows the row count dropping
- [ ] When all replayed → banner disappears

### 8.3 Dead-letter

- [ ] Use a deliberately bad payload (or kill backend) and trigger an operation
- [ ] Wait through the 10 retry attempts (use long mode: hours)
- [ ] Row moves to "Failed" section on Queue page
- [ ] Manual "Retry" button on the failed row works after fixing the backend

### 8.4 Queue page

- [ ] Pending + Failed sections render
- [ ] Per-row: Retry resets retry_count and queues for next drain
- [ ] Per-row: Discard with confirm alert removes the row
- [ ] Page-level: Drain Now triggers immediate drain
- [ ] Page-level: Clear All with confirm alert wipes both sections

## 9. Push notifications

(Requires a backend that can fire test pushes; coordinate with dispatch)

### 9.1 Permission

- [ ] First post-login permission prompt appears
- [ ] Denied → Settings → Notifications shows "Permission: denied"; Re-register works after granting in OS settings

### 9.2 Foreground

- [ ] Fire `route_changed` push → in-app banner appears top of screen with navy left border
- [ ] Tap banner → routes to `/map`
- [ ] Tap X → dismisses without navigation
- [ ] Fire `dispatch_message` push → in-app banner with gold left border
- [ ] Fire `sos_acknowledged` push → in-app banner with green left border + success haptic
- [ ] Fire `system` push with `systemAction='force_logout'` → app navigates to /login

### 9.3 Background

- [ ] App backgrounded → push arrives → system notification appears
- [ ] Tap notification → deep-link routes correctly per category

### 9.4 Token rotation

- [ ] Settings → Notifications shows the same token across launches (stable)
- [ ] If FCM rotates the token (rare), the next launch's diagnostics show the new token

## 10. Settings page

- [ ] Profile shows logged-in user email + truncated user ID
- [ ] Truck + route rows populated when assigned
- [ ] Theme segment: tapping each option updates the app immediately
- [ ] "Current: dark/light" reflects the effective scheme
- [ ] Theme override persists across app restart
- [ ] GPS interval slider: dragging shows "X seconds" updates
- [ ] Toast confirms when interval changes; interval persists across restart
- [ ] "Reset to default" returns the slider to 30s
- [ ] Push: permission + registered + token displayed
- [ ] Re-register button works
- [ ] **A** Open battery settings works
- [ ] **A** Show onboarding again routes to /onboarding
- [ ] Diagnostics: version, env, API base, platform, device ID, queue counts, error reporting status all correct
- [ ] Copy diagnostics → toast confirms; clipboard contains the multi-line summary
- [ ] Sync queue button routes to /queue
- [ ] Sign out → confirm alert → returns to login

## 11. Theme & dark mode

- [ ] Light mode: navy primary, gold accents, light surfaces
- [ ] Dark mode: lifted navy `#4A6EE5` primary, dark surfaces, all text legible
- [ ] Switching OS theme with preference='system' updates app immediately (no relaunch)
- [ ] Preference='dark' on light OS → app stays dark
- [ ] Preference='light' on dark OS → app stays light
- [ ] Status bar icons readable in both modes (light text on dark bg, dark text on light bg)

## 12. Connectivity edge cases

- [ ] Toggle airplane mode mid-action → operation queues, UI doesn't crash
- [ ] Cellular → WiFi transition → drain triggers automatically
- [ ] App background → foreground → connectivity rechecked
- [ ] Token expires while offline → next online action triggers refresh
- [ ] Token expires + no refresh response → next protected route prompts re-login

## 13. Native lifecycle

- [ ] Swipe away from app multitask while day active → notification persists
- [ ] Reopen via tap on notification → app restores to last route
- [ ] **A** Kill via Settings → Apps → Force Stop → next launch behaves like fresh start (but session persists if biometric set)
- [ ] **iOS** App refresh background mode does NOT prevent GPS tracking

## 14. Brand / visual polish

- [ ] App icon on home screen: navy bg + CurTIS wordmark, no white border or distortion
- [ ] **A** Adaptive icon: launcher applies parallax in supported launchers without clipping the wordmark
- [ ] Splash screen: navy bg matches app icon (no flash of white)
- [ ] Login hero icon tile matches the splash aesthetic
- [ ] All buttons, tiles, and accents use navy primary + gold tertiary consistently
- [ ] No leftover forest-green from the pre-Phase 8 palette anywhere

## 15. Error reporting (Sentry — only if DSN configured)

- [ ] Settings → Diagnostics shows "Error reporting: Active"
- [ ] Trigger a deliberate error (e.g. malformed action) → Sentry project receives the event with user ID, platform tag, release version
- [ ] Authorization headers and password fields are NOT visible in the Sentry event
- [ ] Dead-letter event in offline queue surfaces as a warning-level event in Sentry

## 16. Performance

- [ ] Cold app launch < 4s on a mid-range Android (e.g. Pixel 7a)
- [ ] Route navigation between pages < 300ms perceived
- [ ] GPS pings don't cause UI jank (no main-thread blocks)
- [ ] Map tile loading doesn't freeze the page
- [ ] Memory stays under 200 MB after 1 hour of active use
- [ ] Battery drain reasonable: < 10% per hour with full tracking on a Pixel 7a (rough benchmark)

---

## Sign-off

Tester name: __________________________
Device model + OS: __________________________
Date: __________________________
Build hash: __________________________
Result: PASS / FAIL  __ items failed (attach details if FAIL)
