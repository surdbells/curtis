import { Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export type ColorScheme = 'light' | 'dark';

/**
 * Reactive theme service.
 *
 * Currently follows the OS preference (prefers-color-scheme) — there is no
 * user-facing toggle in Phase 5. A future settings screen can call
 * setOverride() to force a scheme.
 *
 * Side effect: when the scheme changes, the native status bar style is
 * synced so the time/battery/wifi icons stay legible against the toolbar.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly scheme = signal<ColorScheme>('light');

  init(): void {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (dark: boolean) => {
      const next: ColorScheme = dark ? 'dark' : 'light';
      this.scheme.set(next);
      this.syncStatusBar(next);
    };
    apply(mql.matches);

    // Support both modern + legacy MediaQueryList listener APIs.
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', (e) => apply(e.matches));
    } else if (typeof (mql as MediaQueryList & { addListener?: (cb: (e: MediaQueryListEvent) => void) => void }).addListener === 'function') {
      (mql as MediaQueryList & { addListener: (cb: (e: MediaQueryListEvent) => void) => void }).addListener((e) => apply(e.matches));
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
