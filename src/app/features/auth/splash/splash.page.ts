import { Component, ChangeDetectionStrategy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';

import { SessionStore } from '../../../core/stores/session.store';
import { BiometricService } from '../../../core/services/biometric.service';
import { PushService } from '../../../core/services/push.service';
import { isExpired } from '../../../core/utils/jwt.util';

@Component({
  selector: 'curtis-splash',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicModule],
  styles: [
    `
      :host { display: block; height: 100%; }
      ion-content::part(scroll) { display: flex; align-items: center; justify-content: center; }

      .stage {
        position: relative;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1.5rem;
        background: var(--curtis-gradient-primary);
        color: var(--curtis-text-inverse);
        text-align: center;
        padding: 2rem;
        overflow: hidden;
      }
      .stage::after {
        content: '';
        position: absolute; inset: 0;
        background: radial-gradient(90% 60% at 50% 40%, rgba(255,255,255,0.10), transparent 70%);
        pointer-events: none;
      }

      .wordmark {
        position: relative;
        z-index: 1;
        max-width: 76%;
        height: auto;
        animation: in 700ms cubic-bezier(0.16, 1, 0.3, 1) both;
        filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.35));
      }

      .tag {
        position: relative;
        z-index: 1;
        opacity: 0.78;
        font-size: 0.75rem;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        font-weight: 600;
        animation: in 700ms cubic-bezier(0.16, 1, 0.3, 1) 120ms both;
      }

      .pulse {
        position: relative;
        z-index: 1;
        margin-top: 1.25rem;
        animation: in 700ms cubic-bezier(0.16, 1, 0.3, 1) 240ms both;
      }
      .pulse ion-spinner { --color: var(--curtis-text-inverse); }

      @keyframes in {
        from { opacity: 0; transform: translateY(8px) scale(0.97); }
        to   { opacity: 1; transform: translateY(0)   scale(1);    }
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
        <div class="tag">Cash-in-Transit Field Ops</div>
        <div class="pulse">
          <ion-spinner name="crescent" />
        </div>
      </div>
    </ion-content>
  `,
})
export class SplashPage implements OnInit {
  private readonly session = inject(SessionStore);
  private readonly biometric = inject(BiometricService);
  private readonly push = inject(PushService);
  private readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    await new Promise((r) => setTimeout(r, 700));
    const target = await this.decideRoute();
    if (target === '/dashboard') {
      // Already authenticated — re-register for pushes so we pick up
      // any token rotation from FCM/APNs since the last launch.
      void this.push.register().catch(() => undefined);
    }
    void this.router.navigateByUrl(target, { replaceUrl: true });
  }

  private async decideRoute(): Promise<string> {
    const token = this.session.accessToken();
    const authed = this.session.isAuthenticated() && !isExpired(token, 0);
    if (authed) return '/dashboard';

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
