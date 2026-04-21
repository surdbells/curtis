import { Component, ChangeDetectionStrategy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { SessionStore } from '../../../core/stores/session.store';
import { isExpired } from '../../../core/utils/jwt.util';

/**
 * Splash page. Shown for a beat on cold start while we decide where to go:
 *   - Valid session → /dashboard
 *   - Expired / absent session → /login
 *
 * Phase 2 will add biometric unlock as a third branch when stored credentials
 * exist and biometry is available.
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
        letter-spacing: 2px;
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
  private readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    // Tiny delay so the splash is perceivable on fast cold starts.
    await new Promise((r) => setTimeout(r, 400));

    const token = this.session.accessToken();
    const authed = this.session.isAuthenticated() && !isExpired(token, 0);
    void this.router.navigateByUrl(authed ? '/dashboard' : '/login', { replaceUrl: true });
  }
}
