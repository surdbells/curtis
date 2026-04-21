import { Component, ChangeDetectionStrategy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';

import { BiometricService } from '../../../core/services/biometric.service';
import { AuthService } from '../../../core/services/auth.service';

/**
 * Biometric unlock page.
 *
 * Prompts the user for fingerprint / Face ID, reads the stored credentials,
 * and silently re-authenticates via AuthService.login.
 *
 * NOTE: credential enrollment (writing the credentials in the first place)
 * will happen from a settings screen in a later phase. Until enrollment is
 * wired, this page is effectively unreachable — the splash only routes
 * here when stored credentials exist.
 */
@Component({
  selector: 'curtis-biometric-unlock',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule, RouterLink],
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
        padding: 1.5rem;
      }
      ion-icon.hero {
        font-size: 4rem;
        color: var(--ion-color-primary);
      }
      h2 {
        margin: 0;
      }
      p.sub {
        color: var(--ion-color-medium);
        margin: 0;
      }
    `,
  ],
  template: `
    <ion-content>
      <div class="wrap">
        <ion-icon class="hero" name="finger-print-outline" />
        <h2>Unlock CurTIS</h2>
        <p class="sub">
          @if (working()) {
            Authenticating…
          } @else {
            Confirm your identity to continue
          }
        </p>

        <ion-button [disabled]="working()" (click)="runUnlock()">
          @if (working()) {
            <ion-spinner slot="start" name="crescent" />
          }
          Try again
        </ion-button>

        <ion-button fill="outline" color="medium" routerLink="/login">
          Use password instead
        </ion-button>
      </div>
    </ion-content>
  `,
})
export class BiometricUnlockPage implements OnInit {
  private readonly biometric = inject(BiometricService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastController);

  protected readonly working = signal(false);

  async ngOnInit(): Promise<void> {
    // Kick off the prompt automatically on entry.
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
          next: () => {
            resolve();
            sub.unsubscribe();
          },
          error: (err) => {
            reject(err);
            sub.unsubscribe();
          },
        });
      });

      await this.router.navigateByUrl('/dashboard', { replaceUrl: true });
    } catch {
      // Biometric cancel, failure, or silent login failure — stay on page so
      // the user can retry or fall back to password.
      await this.showToast('Could not unlock. Try again or use your password.', 'danger');
    } finally {
      this.working.set(false);
    }
  }

  private async showToast(message: string, color: 'danger' | 'warning' | 'success') {
    const t = await this.toast.create({
      message,
      duration: 3000,
      position: 'top',
      color,
      buttons: [{ icon: 'close', role: 'cancel' }],
    });
    await t.present();
  }
}
