import { Component, ChangeDetectionStrategy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthService } from '../../../core/services/auth.service';
import { TokenService } from '../../../core/services/token.service';

/**
 * Login page.
 *
 * Submits credentials to AuthService.login and routes to /dashboard on
 * success. Errors surface as non-blocking toasts per Phase 2 preference.
 *
 * The form is pre-filled with the last successfully-authenticated username
 * (persisted by TokenService) — password is never persisted and must be
 * re-entered every session.
 */
@Component({
  selector: 'curtis-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule, FormsModule],
  styles: [
    `
      .wrap {
        min-height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
      .brand {
        text-align: center;
        padding: 2rem 1rem 1rem;
      }
      .brand h1 {
        font-size: 2rem;
        font-weight: 700;
        letter-spacing: 3px;
        margin: 0;
        color: var(--ion-color-primary);
      }
      .brand p {
        color: var(--ion-color-medium);
        font-size: 0.85rem;
        margin-top: 0.25rem;
      }
      .footer-note {
        text-align: center;
        color: var(--ion-color-medium);
        font-size: 0.75rem;
        padding: 1rem;
      }
    `,
  ],
  template: `
    <ion-content [fullscreen]="true">
      <div class="wrap">
        <div class="brand">
          <h1>CurTIS</h1>
          <p>Cash-in-Transit Field Ops</p>
        </div>

        <form #f="ngForm" (ngSubmit)="submit(f)">
          <ion-list inset>
            <ion-item>
              <ion-input
                label="Username"
                labelPlacement="floating"
                name="username"
                autocapitalize="none"
                autocorrect="off"
                spellcheck="false"
                autocomplete="username"
                required
                [disabled]="loading()"
                [(ngModel)]="username"
              />
            </ion-item>

            <ion-item>
              <ion-input
                [type]="showPassword() ? 'text' : 'password'"
                label="Password"
                labelPlacement="floating"
                name="password"
                autocomplete="current-password"
                required
                [disabled]="loading()"
                [(ngModel)]="password"
              />
              <ion-button
                fill="clear"
                slot="end"
                type="button"
                [disabled]="loading()"
                (click)="togglePassword()"
              >
                <ion-icon
                  slot="icon-only"
                  [name]="showPassword() ? 'eye-off-outline' : 'eye-outline'"
                />
              </ion-button>
            </ion-item>
          </ion-list>

          <div class="ion-padding">
            <ion-button expand="block" type="submit" [disabled]="loading() || f.invalid">
              @if (loading()) {
                <ion-spinner slot="start" name="crescent" />
                Signing in…
              } @else {
                Sign in
              }
            </ion-button>
          </div>
        </form>

        <div class="footer-note">
          Need help? Contact your operations lead.
        </div>
      </div>
    </ion-content>
  `,
})
export class LoginPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly tokens = inject(TokenService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastController);

  protected username = '';
  protected password = '';
  protected readonly showPassword = signal(false);
  protected readonly loading = signal(false);

  async ngOnInit(): Promise<void> {
    const last = await this.tokens.lastUsername();
    if (last) this.username = last;
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  async submit(form: NgForm): Promise<void> {
    if (form.invalid || this.loading()) return;

    const userName = this.username.trim();
    const password = this.password;

    if (!userName || !password) {
      await this.showToast('Enter both username and password', 'warning');
      return;
    }

    this.loading.set(true);
    try {
      await new Promise<void>((resolve, reject) => {
        const sub = this.auth.login(userName, password).subscribe({
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
    } catch (err) {
      await this.showToast(this.describeError(err), 'danger');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Convert the various error shapes we might see into a short user-facing
   * message. Priority order:
   *   1. Envelope with `message` (status !== "0" from backend)
   *   2. HttpErrorResponse with 4xx/5xx
   *   3. Network / unknown
   */
  private describeError(err: unknown): string {
    if (err && typeof err === 'object') {
      // Envelope from ApiService throw (status !== "0").
      const e = err as { status?: string; message?: string };
      if (typeof e.message === 'string' && e.message.trim()) return e.message;
    }

    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) return 'Network unreachable. Check your connection and try again.';
      if (err.status === 401) return 'Incorrect username or password.';
      if (err.status >= 500) return 'Server error. Please try again in a moment.';
      // Envelope might be on err.error.
      const body = err.error as { message?: string } | undefined;
      if (body?.message) return body.message;
      return `Sign-in failed (${err.status}).`;
    }

    return 'Sign-in failed. Please try again.';
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
