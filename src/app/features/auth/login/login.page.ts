import { Component, ChangeDetectionStrategy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { HttpErrorResponse } from '@angular/common/http';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

import { AuthService } from '../../../core/services/auth.service';
import { TokenService } from '../../../core/services/token.service';
import { PushService } from '../../../core/services/push.service';

@Component({
  selector: 'curtis-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule, FormsModule],
  styles: [
    `
      :host { display: block; }
      ion-content { --background: var(--curtis-bg); }

      .wrap {
        min-height: 100%;
        display: flex; flex-direction: column;
        padding: 2rem 1.25rem 1.5rem;
      }

      .hero { text-align: center; margin-top: 1.5rem; }
      .mark {
        width: 64px; height: 64px;
        margin: 0 auto 0.9rem;
        border-radius: 18px;
        display: grid; place-items: center;
        background: var(--curtis-gradient-primary);
        box-shadow: var(--curtis-shadow-md);
      }
      .mark ion-icon { font-size: 1.8rem; color: var(--ion-color-tertiary); }
      .hero h1 {
        font-size: 1.5rem; font-weight: 800;
        letter-spacing: 0.12em; margin: 0;
        color: var(--curtis-text);
      }
      .hero p {
        color: var(--curtis-text-subtle);
        margin-top: 0.25rem; font-size: 0.85rem;
      }

      .card {
        margin-top: 2rem;
        padding: 1.25rem;
        background: var(--curtis-surface-1);
        border: 1px solid var(--curtis-border);
        border-radius: var(--curtis-radius-lg);
        box-shadow: var(--curtis-shadow-md);
      }
      .card h2 {
        margin: 0 0 1rem;
        font-size: 1.05rem; font-weight: 700;
        color: var(--curtis-text);
      }

      ion-list.fields { background: transparent; padding: 0; margin-bottom: 1rem; }
      ion-list.fields ion-item {
        --background: var(--curtis-surface-2);
        --border-color: var(--curtis-border);
        --border-radius: var(--curtis-radius-md);
        --inner-padding-end: 0;
        --padding-start: 0.75rem;
        margin-bottom: 0.6rem;
        border-radius: var(--curtis-radius-md);
        border: 1px solid var(--curtis-border);
      }

      ion-button.cta { height: 50px; font-size: 1rem; }

      .footer {
        margin-top: auto;
        text-align: center;
        color: var(--curtis-text-subtle);
        font-size: 0.72rem;
        padding-top: 1.5rem;
      }
    `,
  ],
  template: `
    <ion-content [fullscreen]="true">
      <div class="wrap">
        <div class="hero">
          <div class="mark">
            <ion-icon name="shield-checkmark-outline" />
          </div>
          <h1>CurTIS</h1>
          <p>Cash-in-Transit Field Ops</p>
        </div>

        <form #f="ngForm" (ngSubmit)="submit(f)" class="card">
          <h2>Sign in to continue</h2>

          <ion-list class="fields" lines="none">
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
                fill="clear" slot="end" type="button"
                [disabled]="loading()" (click)="togglePassword()"
              >
                <ion-icon
                  slot="icon-only"
                  [name]="showPassword() ? 'eye-off-outline' : 'eye-outline'"
                />
              </ion-button>
            </ion-item>
          </ion-list>

          <ion-button
            class="cta"
            expand="block" type="submit"
            [disabled]="loading() || f.invalid"
          >
            @if (loading()) {
              <ion-spinner slot="start" name="crescent" />
              Signing in…
            } @else {
              Sign in
              <ion-icon slot="end" name="arrow-forward-outline" />
            }
          </ion-button>
        </form>

        <div class="footer">
          Need help? Contact your operations lead.
        </div>
      </div>
    </ion-content>
  `,
})
export class LoginPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly tokens = inject(TokenService);
  private readonly push = inject(PushService);
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
      // Fire-and-forget push registration. Permission prompt may appear;
      // login navigation is not blocked on the result.
      void this.push.register().catch(() => undefined);
      await this.router.navigateByUrl('/dashboard', { replaceUrl: true });
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
