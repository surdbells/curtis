import { Component, ChangeDetectionStrategy } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { RouterLink } from '@angular/router';

/**
 * Biometric unlock page — shown on cold start when stored credentials exist
 * and biometry is available on this device.
 *
 * TODO(phase-2): wire BiometricService.verify() → getCredentials() →
 * AuthService.login() silently → route to /dashboard. Fall back to /login
 * on failure.
 */
@Component({
  selector: 'curtis-biometric-unlock',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicModule, RouterLink],
  styles: [
    `
      .wrap {
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        text-align: center;
      }
      ion-icon {
        font-size: 4rem;
        color: var(--ion-color-primary);
      }
    `,
  ],
  template: `
    <ion-content>
      <div class="wrap">
        <ion-icon name="finger-print-outline" />
        <h2>Unlock CurTIS</h2>
        <p style="color: var(--ion-color-medium);">
          Phase 2 will prompt biometric authentication.
        </p>
        <ion-button fill="outline" routerLink="/login">Use password instead</ion-button>
      </div>
    </ion-content>
  `,
})
export class BiometricUnlockPage {}
