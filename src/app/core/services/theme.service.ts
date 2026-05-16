import { Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Preferences } from '@capacitor/preferences';

export type ColorScheme = 'light' | 'dark';
export type ThemePreference = 'system' | 'light' | 'dark';

const PREF_KEY = 'curtis.theme.preference';

/**
 * Reactive theme service.
 *
 * Three modes:
 *   - 'system' (default) — follow prefers-color-scheme
 *   - 'light'            — force light regardless of OS
 *   - 'dark'             — force dark regardless of OS
 *
 * State:
 *   - preference: ThemePreference  (the agent's chosen mode)
 *   - scheme:     ColorScheme      (the effective scheme right now)
 *
 * On scheme change the native status-bar style is synced so the system
 * icons stay legible against the toolbar.
 *
 * The override is applied by toggling a `.curtis-force-light` /
 * `.curtis-force-dark` class on <html>. Global styles in global.scss
 * use these to short-circuit the prefers-color-scheme media query.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly preference = signal<ThemePreference>('system');
  readonly scheme = signal<ColorScheme>('light');

  private mql: MediaQueryList | null = null;
  private mqlListener: ((e: MediaQueryListEvent) => void) | null = null;

  /**
   * Called once at app bootstrap. Reads the persisted preference (if
   * any), then applies the effective scheme and wires the
   * prefers-color-scheme listener for the 'system' mode.
   */
  async init(): Promise<void> {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    // Load persisted preference.
    let pref: ThemePreference = 'system';
    try {
      const { value } = await Preferences.get({ key: PREF_KEY });
      if (value === 'light' || value === 'dark' || value === 'system') {
        pref = value;
      }
    } catch {
      // ignore — fall through to system default
    }
    this.preference.set(pref);

    // Attach a single matchMedia listener; it stays alive for the app
    // lifetime so 'system' mode auto-tracks OS theme changes.
    this.mql = window.matchMedia('(prefers-color-scheme: dark)');
    this.mqlListener = () => this.recompute();
    if (typeof this.mql.addEventListener === 'function') {
      this.mql.addEventListener('change', this.mqlListener);
    } else if (typeof (this.mql as MediaQueryList & { addListener?: (cb: (e: MediaQueryListEvent) => void) => void }).addListener === 'function') {
      (this.mql as MediaQueryList & { addListener: (cb: (e: MediaQueryListEvent) => void) => void }).addListener(this.mqlListener);
    }

    this.recompute();
  }

  /**
   * Set the agent's theme preference. Persists the choice and applies
   * the new scheme immediately.
   */
  async setPreference(pref: ThemePreference): Promise<void> {
    this.preference.set(pref);
    try {
      await Preferences.set({ key: PREF_KEY, value: pref });
    } catch {
      // ignore — preference still applied in-memory
    }
    this.recompute();
  }

  /** Recompute the effective scheme from preference + media query. */
  private recompute(): void {
    const pref = this.preference();
    const systemDark = this.mql?.matches ?? false;
    const effective: ColorScheme =
      pref === 'system' ? (systemDark ? 'dark' : 'light') : pref;

    this.scheme.set(effective);
    this.applyOverrideClass(pref, effective);
    void this.syncStatusBar(effective);
  }

  /**
   * Toggle html element classes that override the prefers-color-scheme
   * media query in global.scss. We only set 'curtis-force-dark' when
   * the agent has explicitly chosen dark AND the OS isn't already dark
   * (and vice versa for light) — this keeps the cascade simple.
   */
  private applyOverrideClass(pref: ThemePreference, effective: ColorScheme): void {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    html.classList.remove('curtis-force-light', 'curtis-force-dark');
    if (pref === 'light' && effective === 'light') {
      html.classList.add('curtis-force-light');
    } else if (pref === 'dark' && effective === 'dark') {
      html.classList.add('curtis-force-dark');
    }
  }

  private async syncStatusBar(scheme: ColorScheme): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await StatusBar.setStyle({ style: scheme === 'dark' ? Style.Dark : Style.Light });
    } catch {
      // Plugin may not be available on some platforms — ignore silently.
    }
  }
}
