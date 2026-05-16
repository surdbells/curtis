import { Component, ChangeDetectionStrategy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';

import { BiometricService } from '../../../core/services/biometric.service';
import { AuthService } from '../../../core/services/auth.service';
import { PushService } from '../../../core/services/push.service';
import { OnboardingService } from '../../../core/services/onboarding.service';
import { CurtisIconComponent } from '../../../shared/components/icon';

/**
 * Biometric unlock — Phase 9 premium design.
 *
 * Auto-fires the OS biometric prompt on entry. The agent sees a large
 * pulsing fingerprint glyph centred on a navy-tinted backdrop, with
 * inline action buttons. Failures keep the agent on the page so they
 * can retry or fall back to password.
 *
 * Behavior is unchanged from Phase 8.
 */
@Component({
  selector: 'curtis-biometric-unlock',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule, RouterLink, CurtisIconComponent],
  styles: [
    `
      :host { display: block; height: 100%; }
      ion-content { --background: var(--curtis-bg); }

      .stage {
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--curtis-space-6);
        padding: var(--curtis-space-6);
        text-align: center;
      }

      .glyph-wrap {
        position: relative;
        width: 140px;
        height: 140px;
        display: grid;
        place-items: center;
        border-radius: var(--curtis-radius-pill);
        background: color-mix(in srgb, var(--ion-color-primary) 8%, transparent);
        animation: pulse 2.4s var(--curtis-ease-in-out) infinite;
      }
      .glyph-wrap::before {
        content: '';
        position: absolute;
        inset: -8px;
        border-radius: var(--curtis-radius-pill);
        border: 1px solid color-mix(in srgb, var(--ion-color-primary) 20%, transparent);
        animation: ring 2.4s var(--curtis-ease-in-out) infinite;
      }
      .glyph-wrap curtis-icon {
        color: var(--ion-color-primary);
      }
      @keyframes pulse {
        0%, 100% { background: color-mix(in srgb, var(--ion-color-primary) 8%, transparent); }
        50%      { background: color-mix(in srgb, var(--ion-color-primary) 14%, transparent); }
      }
      @keyframes ring {
        0%, 100% { transform: scale(1); opacity: 0.6; }
        50%      { transform: scale(1.12); opacity: 0.2; }
      }

      .title {
        font-size: var(--curtis-text-xl);
        font-weight: var(--curtis-weight-extrabold);
        color: var(--curtis-text);
        letter-spacing: var(--curtis-tracking-tight);
        margin: 0;
      }
      .sub {
        color: var(--curtis-text-muted);
        font-size: var(--curtis-text-sm);
        max-width: 24rem;
        margin: 0;
        line-height: var(--curtis-leading-snug);
      }

      .actions {
        display: flex;
        flex-direction: column;
        gap: var(--curtis-space-2);
        width: 100%;
        max-width: 320px;
        margin-top: var(--curtis-space-4);
      }
    `,
  ],
  template: `
    <ion-content [fullscreen]="true">
      <div class="stage">
        <div class="glyph-wrap">
          <curtis-icon name="finger-print-outline" size="xl" [strokeWidth]="1.8" />
        </div>

        <h1 class="title">Unlock CurTIS</h1>
        <p class="sub">
          @if (working()) {
            Authenticating with your device biometric…
          } @else {
            Confirm your identity to continue your shift securely.
          }
        </p>

        <div class="actions">
          <ion-button [disabled]="working()" (click)="runUnlock()">
            @if (working()) {
              <ion-spinner slot="start" name="crescent" />
              Authenticating…
            } @else {
              <curtis-icon slot="start" name="finger-print-outline" size="sm" />
              Try again
            }
          </ion-button>
          <ion-button fill="clear" color="medium" routerLink="/login">
            Use password instead
          </ion-button>
        </div>
      </div>
    </ion-content>
  `,
})
export class BiometricUnlockPage implements OnInit {
  private readonly biometric = inject(BiometricService);
  private readonly auth = inject(AuthService);
  private readonly push = inject(PushService);
  private readonly onboarding = inject(OnboardingService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastController);

  protected readonly working = signal(false);

  async ngOnInit(): Promise<void> {
    void this.runUnlock();
  }

  async runUnlock(): Promise<void> {
    if (this.working()) return;
    this.working.set(true);
    try {
      await this.biometric.verify('Unlock CurTIS to continue your shift');

      const creds = await this.biometric.getCredentials();
      if (!creds) {
        await this.showToast('No stored credentials found. Please sign in.', 'warning');
        void this.router.navigateByUrl('/login', { replaceUrl: true });
        return;
      }

      await new Promise<void>((resolve, reject) => {
        const sub = this.auth.login(creds.username, creds.password).subscribe({
          next: () => { resolve(); sub.unsubscribe(); },
          error: (err) => { reject(err); sub.unsubscribe(); },
        });
      });

      void this.push.register().catch(() => undefined);
      const target = this.onboarding.completed() ? '/dashboard' : '/onboarding';
      await this.router.navigateByUrl(target, { replaceUrl: true });
    } catch {
      await this.showToast('Could not unlock. Try again or use your password.', 'danger');
    } finally {
      this.working.set(false);
    }
  }

  private async showToast(message: string, color: 'danger' | 'warning' | 'success') {
    const t = await this.toast.create({
      message, duration: 3000, position: 'top', color,
      buttons: [{ icon: 'close', role: 'cancel' }],
    });
    await t.present();
  }
}
