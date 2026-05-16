import { Component, ChangeDetectionStrategy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { IonicModule, ToastController } from '@ionic/angular';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

import { CurtisIconComponent } from '../../../shared/components/icon';
import { AuthService } from '../../../core/services/auth.service';
import { TokenService } from '../../../core/services/token.service';
import { PushService } from '../../../core/services/push.service';
import { OnboardingService } from '../../../core/services/onboarding.service';

/**
 * LoginPage — Phase 9 redesign.
 *
 * Layout: vertical split. Upper third is a navy hero panel with the
 * wordmark and tagline. Lower section is a floating white card with the
 * sign-in form. The card visually 'lifts' from the hero panel via
 * negative margin and shadow.
 *
 * On smaller screens the hero panel shrinks but never disappears — the
 * brand is always visible above the fold.
 *
 * Behavior unchanged from Phase 8: username/password + biometric
 * follow-up + onboarding-gated routing.
 */
@Component({
  selector: 'curtis-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule, FormsModule, CurtisIconComponent],
  styles: [
    `
      :host { display: block; height: 100%; }
      ion-content { --background: var(--curtis-bg); }

      .wrap { display: flex; flex-direction: column; min-height: 100%; }

      /* --- Hero panel --- */
      .hero {
        position: relative;
        background: var(--curtis-gradient-hero);
        color: var(--curtis-text-inverse);
        padding: calc(env(safe-area-inset-top, 0) + var(--curtis-space-12))
                 var(--curtis-space-6)
                 calc(var(--curtis-space-16) + var(--curtis-space-6));
        text-align: center;
        overflow: hidden;
      }
      .hero::before {
        content: '';
        position: absolute; inset: 0;
        background:
          radial-gradient(80% 60% at 50% 30%, rgba(255, 255, 255, 0.10), transparent 65%),
          radial-gradient(60% 50% at 90% 100%, rgba(201, 162, 39, 0.18), transparent 70%);
        pointer-events: none;
      }
      .hero__wordmark {
        position: relative;
        max-width: 220px;
        height: auto;
        margin: 0 auto var(--curtis-space-3);
        filter: drop-shadow(0 8px 22px rgba(0, 0, 0, 0.3));
        animation: rise var(--curtis-duration-slow) var(--curtis-ease-out) both;
      }
      .hero__title {
        position: relative;
        font-size: var(--curtis-text-xl);
        font-weight: var(--curtis-weight-extrabold);
        letter-spacing: var(--curtis-tracking-tight);
        margin: 0;
        animation: rise var(--curtis-duration-slow) var(--curtis-ease-out) 80ms both;
      }
      .hero__tag {
        position: relative;
        font-size: var(--curtis-text-xs);
        font-weight: var(--curtis-weight-semibold);
        letter-spacing: var(--curtis-tracking-widest);
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.78);
        margin-top: var(--curtis-space-2);
        animation: rise var(--curtis-duration-slow) var(--curtis-ease-out) 140ms both;
      }

      /* --- Form card --- */
      .form-wrap {
        flex: 1;
        padding: 0 var(--curtis-space-4) var(--curtis-space-6);
        margin-top: calc(-1 * var(--curtis-space-12));
      }
      .card {
        background: var(--curtis-surface-1);
        border: 1px solid var(--curtis-border);
        border-radius: var(--curtis-radius-xl);
        box-shadow: var(--curtis-shadow-lg);
        padding: var(--curtis-space-6);
        animation: rise var(--curtis-duration-slow) var(--curtis-ease-out) 220ms both;
      }
      .card__heading {
        font-size: var(--curtis-text-lg);
        font-weight: var(--curtis-weight-bold);
        color: var(--curtis-text);
        margin-bottom: var(--curtis-space-1);
      }
      .card__subheading {
        font-size: var(--curtis-text-sm);
        color: var(--curtis-text-muted);
        margin-bottom: var(--curtis-space-6);
      }

      .field {
        display: flex;
        flex-direction: column;
        gap: var(--curtis-space-1_5);
        margin-bottom: var(--curtis-space-4);
      }
      .field__label {
        font-size: var(--curtis-text-xs);
        font-weight: var(--curtis-weight-semibold);
        letter-spacing: var(--curtis-tracking-wide);
        text-transform: uppercase;
        color: var(--curtis-text-subtle);
      }

      .input-wrap {
        position: relative;
        display: flex;
        align-items: center;
        background: var(--curtis-surface-2);
        border: 1px solid var(--curtis-border);
        border-radius: var(--curtis-radius-md);
        transition: border-color var(--curtis-duration-fast) var(--curtis-ease-out),
                    box-shadow var(--curtis-duration-fast) var(--curtis-ease-out);
      }
      .input-wrap:focus-within {
        border-color: var(--ion-color-primary);
        box-shadow: var(--curtis-focus-ring);
        background: var(--curtis-surface-1);
      }
      .input-wrap__icon {
        padding-left: var(--curtis-space-3);
        color: var(--curtis-text-subtle);
      }
      .input-wrap__input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        padding: var(--curtis-space-3) var(--curtis-space-3);
        font-family: var(--curtis-font-sans);
        font-size: var(--curtis-text-base);
        font-weight: var(--curtis-weight-medium);
        color: var(--curtis-text);
        min-height: 44px;
      }
      .input-wrap__input::placeholder {
        color: var(--curtis-text-faint);
        font-weight: var(--curtis-weight-regular);
      }
      .input-wrap__toggle {
        background: none;
        border: none;
        padding: 0 var(--curtis-space-3);
        color: var(--curtis-text-muted);
        cursor: pointer;
        display: flex;
        align-items: center;
      }

      .submit-row {
        margin-top: var(--curtis-space-6);
      }

      .footer {
        text-align: center;
        margin-top: var(--curtis-space-4);
        font-size: var(--curtis-text-xs);
        color: var(--curtis-text-subtle);
      }

      @keyframes rise {
        from { opacity: 0; transform: translateY(10px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `,
  ],
  template: `
    <ion-content [fullscreen]="true">
      <div class="wrap">
        <!-- Hero panel -->
        <header class="hero">
          <img
            class="hero__wordmark"
            src="assets/brand/curtis-wordmark.png"
            alt="CurTIS"
          />
          <h1 class="hero__title">Welcome back</h1>
          <div class="hero__tag">Sign in to continue</div>
        </header>

        <!-- Form card -->
        <div class="form-wrap">
          <form #f="ngForm" (ngSubmit)="submit(f)" class="card">
            <div class="card__heading">Sign in to your account</div>
            <div class="card__subheading">Enter your operations credentials below.</div>

            <div class="field">
              <label class="field__label" for="username-input">Username</label>
              <div class="input-wrap">
                <span class="input-wrap__icon">
                  <curtis-icon name="finger-print-outline" size="sm" />
                </span>
                <input
                  id="username-input"
                  class="input-wrap__input"
                  type="text"
                  name="username"
                  autocomplete="username"
                  autocapitalize="off"
                  inputmode="text"
                  placeholder="Your username"
                  [(ngModel)]="username"
                  required
                />
              </div>
            </div>

            <div class="field">
              <label class="field__label" for="password-input">Password</label>
              <div class="input-wrap">
                <span class="input-wrap__icon">
                  <curtis-icon name="finger-print-outline" size="sm" />
                </span>
                <input
                  id="password-input"
                  class="input-wrap__input"
                  [type]="showPassword() ? 'text' : 'password'"
                  name="password"
                  autocomplete="current-password"
                  placeholder="Your password"
                  [(ngModel)]="password"
                  required
                />
                <button
                  type="button"
                  class="input-wrap__toggle"
                  (click)="togglePassword()"
                  [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
                >
                  <curtis-icon [name]="showPassword() ? 'close-outline' : 'play-outline'" size="sm" />
                </button>
              </div>
            </div>

            <div class="submit-row">
              <ion-button
                expand="block" type="submit"
                [disabled]="loading() || f.invalid"
              >
                @if (loading()) {
                  <ion-spinner slot="start" name="crescent" />
                  Signing in…
                } @else {
                  Sign in
                  <curtis-icon slot="end" name="arrow-forward-outline" size="sm" />
                }
              </ion-button>
            </div>

            <div class="footer">
              Need help? Contact your operations lead.
            </div>
          </form>
        </div>
      </div>
    </ion-content>
  `,
})
export class LoginPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly tokens = inject(TokenService);
  private readonly push = inject(PushService);
  private readonly onboarding = inject(OnboardingService);
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
          next: () => { resolve(); sub.unsubscribe(); },
          error: (err) => { reject(err); sub.unsubscribe(); },
        });
      });

      await this.haptic(NotificationType.Success);
      void this.push.register().catch(() => undefined);
      const target = this.onboarding.completed() ? '/dashboard' : '/onboarding';
      await this.router.navigateByUrl(target, { replaceUrl: true });
    } catch (err) {
      await this.haptic(NotificationType.Error);
      await this.showToast(this.describeError(err), 'danger');
    } finally {
      this.loading.set(false);
    }
  }

  private describeError(err: unknown): string {
    if (err && typeof err === 'object') {
      const e = err as { status?: string; message?: string };
      if (typeof e.message === 'string' && e.message.trim()) return e.message;
    }
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) return 'Network unreachable. Check your connection and try again.';
      if (err.status === 401) return 'Incorrect username or password.';
      if (err.status >= 500) return 'Server error. Please try again in a moment.';
      const body = err.error as { message?: string } | undefined;
      if (body?.message) return body.message;
      return `Sign-in failed (${err.status}).`;
    }
    return 'Sign-in failed. Please try again.';
  }

  private async haptic(type: NotificationType): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try { await Haptics.notification({ type }); } catch { /* ignore */ }
  }

  private async showToast(message: string, color: 'danger' | 'warning' | 'success') {
    const t = await this.toast.create({
      message, duration: 3000, position: 'top', color,
      buttons: [{ icon: 'close', role: 'cancel' }],
    });
    await t.present();
  }
}
