import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

/**
 * Login page — form scaffold only.
 *
 * TODO(phase-2): wire AuthService.login, handle loading / error states,
 * capture current geolocation via LocationService.tryGetCurrent(),
 * route to /dashboard on success, offer "Enable biometric unlock" CTA.
 */
@Component({
  selector: 'curtis-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonicModule, FormsModule],
  template: `
    <ion-header translucent>
      <ion-toolbar>
        <ion-title>Sign in</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <form (ngSubmit)="submit()">
        <ion-list inset>
          <ion-item>
            <ion-input
              label="Username"
              labelPlacement="floating"
              name="username"
              [(ngModel)]="username"
              autocomplete="username"
              required
            />
          </ion-item>
          <ion-item>
            <ion-input
              label="Password"
              labelPlacement="floating"
              name="password"
              type="password"
              [(ngModel)]="password"
              autocomplete="current-password"
              required
            />
          </ion-item>
        </ion-list>

        <div class="ion-padding">
          <ion-button expand="block" type="submit" [disabled]="loading()">
            @if (loading()) {
              <ion-spinner name="crescent" slot="start" />
            }
            Sign in
          </ion-button>
          <p class="ion-text-center ion-text-wrap" style="color: var(--ion-color-medium); font-size: 0.85rem;">
            Phase 2 will enable sign in against the Tracking API.
          </p>
        </div>
      </form>
    </ion-content>
  `,
})
export class LoginPage {
  protected username = '';
  protected password = '';
  protected readonly loading = signal(false);

  submit(): void {
    // TODO(phase-2): wire AuthService.login
    // eslint-disable-next-line no-console
    console.log('[login] submit', { user: this.username });
  }
}
