import { Component, ChangeDetectionStrategy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';

import { SessionStore } from '../../../core/stores/session.store';
import { BiometricService } from '../../../core/services/biometric.service';
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
        gap: 1.25rem;
        background: var(--curtis-gradient-primary);
        color: var(--curtis-text-inverse);
        text-align: center;
        padding: 2rem;
      }

      .mark {
        width: 84px;
        height: 84px;
        border-radius: 22px;
        background: rgba(255, 255, 255, 0.12);
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.2),
          0 12px 32px rgba(0, 0, 0, 0.35);
        display: grid;
        place-items: center;
        animation: in 600ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      .mark ion-icon {
        font-size: 2.5rem;
        color: var(--ion-color-tertiary);
      }

      .brand {
        animation: in 600ms cubic-bezier(0.16, 1, 0.3, 1) 80ms both;
      }
      .brand .name {
        font-size: 2rem;
        font-weight: 800;
        letter-spacing: 0.16em;
        margin: 0;
      }
      .brand .tag {
        margin-top: 0.4rem;
        opacity: 0.85;
        font-size: 0.85rem;
        letter-spacing: 0.04em;
      }

      .pulse {
        margin-top: 1.5rem;
        animation: in 600ms cubic-bezier(0.16, 1, 0.3, 1) 200ms both;
      }
      .pulse ion-spinner { --color: var(--curtis-text-inverse); }

      @keyframes in {
        from { opacity: 0; transform: translateY(6px) scale(0.96); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
    `,
  ],
  template: `
    <ion-content [fullscreen]="true">
      <div class="stage">
        <div class="mark">
          <ion-icon name="shield-checkmark-outline" />
        </div>
        <div class="brand">
          <h1 class="name">CurTIS</h1>
          <p class="tag">Cash-in-Transit Field Ops</p>
        </div>
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
  private readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    await new Promise((r) => setTimeout(r, 500));
    void this.router.navigateByUrl(await this.decideRoute(), { replaceUrl: true });
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
