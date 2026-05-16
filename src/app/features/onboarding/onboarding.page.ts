import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';

import { OnboardingService } from '../../core/services/onboarding.service';
import { PushService } from '../../core/services/push.service';
import { SessionStore } from '../../core/stores/session.store';
import { CurtisIconComponent } from '../../shared/components/icon';

interface OnboardingStep {
  id: string;
  icon: string;
  title: string;
  body: string;
  cta?: { label: string; action: () => Promise<void> | void };
}

/**
 * Onboarding — Phase 9 premium redesign.
 *
 * Two-step flow (welcome + battery on Android).
 *   - Step indicator: pill dots, the current one filled
 *   - Hero icon: 88px square in a soft tinted well
 *   - Body text wrapped in a polished info card stack
 *   - Sticky action area at the bottom
 *
 * Behavior is preserved from Phase 8.
 */
@Component({
  selector: 'curtis-onboarding',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule, CurtisIconComponent],
  styles: [
    `
      :host { display: block; height: 100%; }
      ion-content { --background: var(--curtis-bg); }

      .stage {
        min-height: 100%;
        display: flex;
        flex-direction: column;
        padding: var(--curtis-space-4);
        padding-top: calc(env(safe-area-inset-top, 0) + var(--curtis-space-4));
        padding-bottom: calc(env(safe-area-inset-bottom, 0) + var(--curtis-space-4));
      }

      /* Step dots */
      .progress {
        display: flex;
        gap: var(--curtis-space-1_5);
        margin-bottom: var(--curtis-space-6);
      }
      .progress__dot {
        flex: 1;
        height: 4px;
        border-radius: var(--curtis-radius-pill);
        background: var(--curtis-border);
        transition: background var(--curtis-duration-normal) var(--curtis-ease-out);
      }
      .progress__dot.active { background: var(--ion-color-primary); }

      /* Hero */
      .hero {
        text-align: center;
        margin: var(--curtis-space-4) 0 var(--curtis-space-6);
        animation: rise var(--curtis-duration-slow) var(--curtis-ease-out) both;
      }
      .hero__well {
        width: 96px;
        height: 96px;
        margin: 0 auto var(--curtis-space-4);
        border-radius: var(--curtis-radius-2xl);
        display: grid;
        place-items: center;
        background: var(--curtis-gradient-primary);
        color: var(--ion-color-tertiary);
        box-shadow: var(--curtis-shadow-md);
      }
      .hero__title {
        font-size: var(--curtis-text-2xl);
        font-weight: var(--curtis-weight-extrabold);
        color: var(--curtis-text);
        letter-spacing: var(--curtis-tracking-tight);
        margin: 0 0 var(--curtis-space-2);
      }
      .hero__body {
        color: var(--curtis-text-muted);
        font-size: var(--curtis-text-base);
        line-height: var(--curtis-leading-snug);
        max-width: 28rem;
        margin: 0 auto;
      }

      /* Info card stack */
      .info-stack {
        display: flex;
        flex-direction: column;
        gap: var(--curtis-space-3);
        animation: rise var(--curtis-duration-slow) var(--curtis-ease-out) 100ms both;
      }
      .info-card {
        display: flex;
        gap: var(--curtis-space-3);
        padding: var(--curtis-space-4);
        background: var(--curtis-surface-1);
        border: 1px solid var(--curtis-border);
        border-radius: var(--curtis-radius-lg);
        box-shadow: var(--curtis-shadow-xs);
      }
      .info-card__icon {
        flex-shrink: 0;
        width: 36px;
        height: 36px;
        border-radius: var(--curtis-radius-md);
        display: grid;
        place-items: center;
        background: color-mix(in srgb, var(--ion-color-tertiary) 16%, transparent);
        color: var(--gold-700);
      }
      .info-card--warn .info-card__icon {
        background: color-mix(in srgb, var(--ion-color-warning) 18%, transparent);
        color: var(--amber-500);
      }
      .info-card__text {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: var(--curtis-space-0_5);
        min-width: 0;
      }
      .info-card__title {
        font-size: var(--curtis-text-sm);
        font-weight: var(--curtis-weight-bold);
        color: var(--curtis-text);
      }
      .info-card__body {
        font-size: var(--curtis-text-sm);
        color: var(--curtis-text-muted);
        line-height: var(--curtis-leading-snug);
      }

      /* Actions */
      .actions {
        margin-top: auto;
        padding-top: var(--curtis-space-6);
        display: flex;
        flex-direction: column;
        gap: var(--curtis-space-2);
      }

      @keyframes rise {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `,
  ],
  template: `
    <ion-content [fullscreen]="true">
      <div class="stage">
        <div class="progress">
          @for (s of steps(); let i = $index; track s.id) {
            <span class="progress__dot" [class.active]="i <= stepIndex()"></span>
          }
        </div>

        @if (currentStep(); as step) {
          <div class="hero">
            <div class="hero__well">
              <curtis-icon [name]="step.icon" size="xl" [strokeWidth]="1.8" />
            </div>
            <h1 class="hero__title">{{ step.title }}</h1>
            <p class="hero__body">{{ step.body }}</p>
          </div>

          @if (step.id === 'welcome') {
            <div class="info-stack">
              <div class="info-card">
                <div class="info-card__icon">
                  <curtis-icon name="navigate-circle-outline" size="sm" />
                </div>
                <div class="info-card__text">
                  <span class="info-card__title">Live route tracking</span>
                  <span class="info-card__body">
                    Your truck location is shared with dispatch every 30 seconds while you're on shift. A persistent notification confirms it's running.
                  </span>
                </div>
              </div>
              <div class="info-card">
                <div class="info-card__icon">
                  <curtis-icon name="cloud-upload-outline" size="sm" />
                </div>
                <div class="info-card__text">
                  <span class="info-card__title">Offline-safe</span>
                  <span class="info-card__body">
                    Drop signal? Reports and scans queue up and sync automatically when connection returns.
                  </span>
                </div>
              </div>
              <div class="info-card">
                <div class="info-card__icon">
                  <curtis-icon name="notifications-outline" size="sm" />
                </div>
                <div class="info-card__text">
                  <span class="info-card__title">Dispatch alerts</span>
                  <span class="info-card__body">
                    Route changes, urgent messages, and SOS confirmations arrive as push notifications.
                  </span>
                </div>
              </div>
            </div>
          }

          @if (step.id === 'battery' && isAndroid()) {
            <div class="info-stack">
              <div class="info-card info-card--warn">
                <div class="info-card__icon">
                  <curtis-icon name="warning-outline" size="sm" />
                </div>
                <div class="info-card__text">
                  <span class="info-card__title">Why this matters</span>
                  <span class="info-card__body">
                    By default, Android may stop CurTIS from running in the background to save battery. For CIT safety, the tracking service needs to stay active throughout your shift.
                  </span>
                </div>
              </div>
              <div class="info-card">
                <div class="info-card__icon">
                  <curtis-icon name="checkmark-circle-outline" size="sm" />
                </div>
                <div class="info-card__text">
                  <span class="info-card__title">What to do</span>
                  <span class="info-card__body">
                    Tap "Open settings" below. On the next screen, find CurTIS and select "Don't optimise" (or "Allow background activity" — wording varies by device).
                  </span>
                </div>
              </div>
            </div>
          }

          <div class="actions">
            @if (step.cta) {
              <ion-button expand="block" (click)="runCta(step.cta)">
                <curtis-icon slot="start" name="settings-outline" size="sm" />
                {{ step.cta.label }}
              </ion-button>
            }
            <ion-button
              expand="block"
              [fill]="step.cta ? 'clear' : 'solid'"
              [color]="step.cta ? 'medium' : 'primary'"
              (click)="next()"
            >
              {{ isLastStep() ? "I'm ready — start using CurTIS" : 'Continue' }}
              @if (!isLastStep()) {
                <curtis-icon slot="end" name="arrow-forward-outline" size="sm" />
              }
            </ion-button>
          </div>
        }
      </div>
    </ion-content>
  `,
})
export class OnboardingPage implements OnInit {
  private readonly onboarding = inject(OnboardingService);
  private readonly push = inject(PushService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastController);

  protected readonly stepIndex = signal(0);
  protected readonly isAndroid = signal(Capacitor.getPlatform() === 'android');
  protected readonly steps = signal<OnboardingStep[]>(this.buildSteps());
  protected readonly currentStep = computed(() => this.steps()[this.stepIndex()] ?? null);
  protected readonly isLastStep = computed(() => this.stepIndex() === this.steps().length - 1);

  async ngOnInit(): Promise<void> {
    if (!this.session.isAuthenticated()) {
      void this.router.navigateByUrl('/login', { replaceUrl: true });
    }
  }

  protected async next(): Promise<void> {
    if (this.isLastStep()) {
      await this.complete();
      return;
    }
    this.stepIndex.update((i) => i + 1);
  }

  protected async runCta(cta: NonNullable<OnboardingStep['cta']>): Promise<void> {
    try { await cta.action(); } catch { /* ignore */ }
  }

  private async complete(): Promise<void> {
    await this.onboarding.markComplete();
    void this.push.register().catch(() => undefined);
    await this.router.navigateByUrl('/dashboard', { replaceUrl: true });
  }

  private buildSteps(): OnboardingStep[] {
    const steps: OnboardingStep[] = [
      {
        id: 'welcome',
        icon: 'shield-checkmark-outline',
        title: 'Welcome to CurTIS',
        body: "You're set up. Here's what CurTIS does in the background once your day starts.",
      },
    ];
    if (Capacitor.getPlatform() === 'android') {
      steps.push({
        id: 'battery',
        icon: 'battery-charging-outline',
        title: 'One quick setup step',
        body: 'Allow CurTIS to run without battery restrictions so location tracking stays active throughout your shift.',
        cta: {
          label: 'Open battery settings',
          action: async () => {
            const opened = await this.onboarding.openBatterySettings();
            if (!opened) {
              const t = await this.toast.create({
                message: "Couldn't open settings directly. Open your phone's Settings app and search for 'battery optimisation' or 'background activity'.",
                duration: 4500, position: 'top', color: 'warning',
                buttons: [{ icon: 'close', role: 'cancel' }],
              });
              await t.present();
            }
          },
        },
      });
    }
    return steps;
  }
}
