import { Component, ChangeDetectionStrategy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';

import { SessionStore } from '../../../core/stores/session.store';
import { BiometricService } from '../../../core/services/biometric.service';
import { isExpired } from '../../../core/utils/jwt.util';

/**
 * Splash page. Shown briefly on cold start while we decide where to route:
 *
 *   1. Valid unexpired session in memory  →  /dashboard
 *   2. Stored biometric credentials + biometry available  →  /biometric-unlock
 *   3. Otherwise  →  /login
 *
 * Phase 2 ships the three-way logic. Until biometric enrollment is added
 * (deferred to a later settings screen), branch 2 never triggers in
 * practice — the fall-through to /login is the common path for expired or
 * absent sessions.
 */
@Component({
  selector: 'curtis-splash',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicModule],
  styles: [
    `
      .wrap {
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1rem;
      }
      .brand {
        font-size: 2rem;
        font-weight: 700;
        letter-spacing: 3px;
        color: var(--ion-color-primary);
      }
      .tag {
        color: var(--ion-color-medium);
        font-size: 0.9rem;
      }
    `,
  ],
  template: `
    <ion-content>
      <div class="wrap">
        <div class="brand">CurTIS</div>
        <div class="tag">Cash-in-Transit Field Ops</div>
        <ion-spinner name="crescent" />
      </div>
    </ion-content>
  `,
})
export class SplashPage implements OnInit {
  private readonly session = inject(SessionStore);
  private readonly biometric = inject(BiometricService);
  private readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    // Tiny delay so the splash is perceivable on fast cold starts.
    await new Promise((r) => setTimeout(r, 400));

    const destination = await this.decideRoute();
    void this.router.navigateByUrl(destination, { replaceUrl: true });
  }

  private async decideRoute(): Promise<string> {
    const token = this.session.accessToken();
    const authed = this.session.isAuthenticated() && !isExpired(token, 0);
    if (authed) return '/dashboard';

    // Expired-or-absent session. Offer biometric unlock only if both
    // (a) platform biometry is available AND (b) we have stored credentials.
    try {
      const biometry = await this.biometric.available();
      if (biometry) {
        const creds = await this.biometric.getCredentials();
        if (creds) return '/biometric-unlock';
      }
    } catch {
      // biometry unavailable — fall through
    }

    return '/login';
  }
}
