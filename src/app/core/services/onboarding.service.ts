import { Injectable, inject, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { AppLauncher } from '@capacitor/app-launcher';
import { ErrorReportingService } from './error-reporting.service';

const ONBOARDING_KEY = 'curtis.onboarding.completed';
const ONBOARDING_VERSION = 1; // bump when a new mandatory step is added

/**
 * One-time post-login onboarding state.
 *
 * Used by:
 *   - LoginPage / BiometricUnlockPage post-success to decide whether to
 *     route the agent to /onboarding before /dashboard.
 *   - OnboardingPage to mark completion.
 *
 * Versioned: bumping ONBOARDING_VERSION causes every agent to see the
 * onboarding flow once on their next login. Use this when a new
 * mandatory permission step is added that existing agents haven't
 * granted yet.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private readonly errorReporting = inject(ErrorReportingService);

  /** Reactive completion state — refreshed on init and on markComplete. */
  readonly completed = signal<boolean>(false);
  readonly checked = signal<boolean>(false);

  /** Load the persisted completion marker. Idempotent. */
  async hydrate(): Promise<void> {
    try {
      const { value } = await Preferences.get({ key: ONBOARDING_KEY });
      const parsed = value ? Number(value) : 0;
      this.completed.set(Number.isFinite(parsed) && parsed >= ONBOARDING_VERSION);
    } catch (err) {
      this.errorReporting.captureError(err, { feature: 'onboarding.hydrate' });
    } finally {
      this.checked.set(true);
    }
  }

  /** Mark onboarding as completed for the current version. */
  async markComplete(): Promise<void> {
    try {
      await Preferences.set({ key: ONBOARDING_KEY, value: String(ONBOARDING_VERSION) });
      this.completed.set(true);
    } catch (err) {
      this.errorReporting.captureError(err, { feature: 'onboarding.markComplete' });
    }
  }

  /** For testing or "reset onboarding" debug button in Settings. */
  async reset(): Promise<void> {
    try {
      await Preferences.remove({ key: ONBOARDING_KEY });
      this.completed.set(false);
    } catch {
      // ignore
    }
  }

  /**
   * Open the Android "Ignore battery optimisations" settings page so the
   * agent can whitelist CurTIS. Required for the foreground GPS service
   * to keep running reliably with the screen off.
   *
   * Uses @capacitor/app-launcher to fire the Settings intent. The
   * specific intent action ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS
   * brings up the system list with the toggle pre-scoped to all apps.
   *
   * On iOS this is a no-op (iOS handles background CIT-style apps via
   * the `location` background mode declared in Info.plist, not via a
   * user-facing battery-exemption toggle).
   *
   * Returns true if the settings page was launched, false if the
   * platform doesn't support it (iOS / web).
   */
  async openBatterySettings(): Promise<boolean> {
    if (Capacitor.getPlatform() !== 'android') return false;
    try {
      // Try the most specific action first — opens the list with the
      // battery-optimisation toggle visible. Falls back to the per-app
      // detail page if the first intent isn't available on the device.
      await AppLauncher.openUrl({
        url: 'intent:#Intent;action=android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS;end',
      });
      return true;
    } catch (err) {
      this.errorReporting.captureError(err, { feature: 'onboarding.openBatterySettings' });
      // Fallback: app's own detail page where the agent can navigate to
      // Battery -> Unrestricted.
      try {
        await AppLauncher.openUrl({
          url: 'intent:#Intent;action=android.settings.APPLICATION_DETAILS_SETTINGS;package=com.kodek.curtis;end',
        });
        return true;
      } catch {
        return false;
      }
    }
  }
}
