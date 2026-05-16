import { Component, ChangeDetectionStrategy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';

import { SessionStore } from '../../../core/stores/session.store';
import { BiometricService } from '../../../core/services/biometric.service';
import { PushService } from '../../../core/services/push.service';
import { OnboardingService } from '../../../core/services/onboarding.service';
import { isExpired } from '../../../core/utils/jwt.util';

/**
 * Splash — the first surface every agent sees. Holds for ~800ms while the
 * app decides whether to route to login, biometric-unlock, dashboard, or
 * onboarding. Designed to set the premium navy + gold brand tone before
 * the rest of the app loads.
 *
 * Visual structure:
 *   - Full-bleed navy gradient with radial highlight (warm gold mid-stop)
 *   - Wordmark centred at ~50% of viewport width
 *   - Tagline below in uppercase tracked small caps
 *   - Subtle spinner at the bottom — not the focal point
 *   - Phase 9: type set in Inter at 800 weight via global font config
 */
@Component({
  selector: 'curtis-splash',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicModule],
  styles: [
    `
      :host { display: block; height: 100%; }
      ion-content { --background: var(--navy-900); }
      ion-content::part(scroll) {
        display: flex; align-items: stretch; justify-content: stretch;
      }

      .stage {
        position: relative;
        height: 100%;
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--curtis-space-6);
        background: var(--curtis-gradient-hero);
        color: var(--curtis-text-inverse);
        padding: var(--curtis-space-6);
        text-align: center;
        overflow: hidden;
      }

      /* Soft inner glow — gives the gradient depth */
      .stage::before {
        content: '';
        position: absolute; inset: 0;
        background:
          radial-gradient(90% 60% at 50% 40%, rgba(255, 255, 255, 0.12), transparent 70%),
          radial-gradient(60% 50% at 90% 100%, rgba(201, 162, 39, 0.16), transparent 70%);
        pointer-events: none;
      }
      /* Subtle grain texture for depth at full-screen scale */
      .stage::after {
        content: '';
        position: absolute; inset: 0;
        background-image:
          linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
        background-size: 24px 24px;
        opacity: 0.6;
        pointer-events: none;
      }

      .wordmark {
        position: relative;
        z-index: 1;
        max-width: min(76%, 420px);
        height: auto;
        animation: rise var(--curtis-duration-slower) var(--curtis-ease-out) both;
        filter: drop-shadow(0 14px 36px rgba(0, 0, 0, 0.35));
      }

      .tag {
        position: relative;
        z-index: 1;
        font-size: var(--curtis-text-xs);
        font-weight: var(--curtis-weight-semibold);
        letter-spacing: var(--curtis-tracking-widest);
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.78);
        animation: rise var(--curtis-duration-slower) var(--curtis-ease-out) 140ms both;
      }
      .tag::before, .tag::after {
        content: '';
        display: inline-block;
        width: 24px; height: 1px;
        margin: 0 var(--curtis-space-3);
        background: rgba(255, 255, 255, 0.4);
        vertical-align: middle;
      }

      .spinner-wrap {
        position: relative;
        z-index: 1;
        margin-top: var(--curtis-space-8);
        animation: rise var(--curtis-duration-slower) var(--curtis-ease-out) 280ms both;
      }
      .spinner-wrap ion-spinner {
        --color: var(--gold-300);
        width: 28px;
        height: 28px;
      }

      .signature {
        position: absolute;
        bottom: calc(var(--curtis-space-6) + env(safe-area-inset-bottom, 0));
        left: 0; right: 0;
        z-index: 1;
        font-size: var(--curtis-text-xs);
        letter-spacing: var(--curtis-tracking-wider);
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.4);
        font-weight: var(--curtis-weight-medium);
        animation: fade-in var(--curtis-duration-slower) var(--curtis-ease-out) 420ms both;
      }

      @keyframes rise {
        from { opacity: 0; transform: translateY(12px) scale(0.97); }
        to   { opacity: 1; transform: translateY(0)   scale(1);    }
      }
      @keyframes fade-in {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
    `,
  ],
  template: `
    <ion-content [fullscreen]="true">
      <div class="stage">
        <img
          class="wordmark"
          src="assets/brand/curtis-wordmark.png"
          alt="CurTIS — Currency Tracking and Information System"
        />
        <div class="tag">Cash-in-Transit Field Operations</div>
        <div class="spinner-wrap">
          <ion-spinner name="crescent" />
        </div>
        <div class="signature">Powered by Kodek Innovations</div>
      </div>
    </ion-content>
  `,
})
export class SplashPage implements OnInit {
  private readonly session = inject(SessionStore);
  private readonly biometric = inject(BiometricService);
  private readonly push = inject(PushService);
  private readonly onboarding = inject(OnboardingService);
  private readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    await new Promise((r) => setTimeout(r, 800));
    const target = await this.decideRoute();
    if (target === '/dashboard' || target === '/onboarding') {
      void this.push.register().catch(() => undefined);
    }
    void this.router.navigateByUrl(target, { replaceUrl: true });
  }

  private async decideRoute(): Promise<string> {
    const token = this.session.accessToken();
    const authed = this.session.isAuthenticated() && !isExpired(token, 0);
    if (authed) {
      return this.onboarding.completed() ? '/dashboard' : '/onboarding';
    }

    try {
      const biometry = await this.biometric.available();
      if (biometry) {
        const creds = await this.biometric.getCredentials();
        if (creds) return '/biometric-unlock';
      }
    } catch {
      // fall through
    }
    return '/login';
  }
}
