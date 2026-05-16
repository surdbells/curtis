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

interface OnboardingStep {
  id: string;
  icon: string;
  title: string;
  body: string;
  cta?: { label: string; action: () => Promise<void> | void };
}

/**
 * Post-login onboarding — Phase 8 Commit 3.
 *
 * Shown once per agent (versioned by OnboardingService.ONBOARDING_VERSION).
 * Two steps:
 *   1. Welcome + summary of what CurTIS will be doing in the background
 *      (location tracking, queued sync, push notifications). The agent
 *      is acknowledging awareness — there's no permission grant on
 *      this screen, it's purely informational.
 *   2. Battery optimisation exemption. Explains why Android's default
 *      power saving would kill the foreground GPS service, and provides
 *      a "Open battery settings" CTA that fires the AppLauncher intent.
 *      Skip is allowed — the toggle is on the system side and the
 *      agent might already have it set.
 *
 * iOS hides step 2 (no equivalent toggle) and only shows step 1.
 *
 * On completion, OnboardingService.markComplete is called and the
 * agent is routed to /dashboard.
 */
@Component({
  selector: 'curtis-onboarding',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonicModule],
  styles: [
    `
      :host { display: block; height: 100%; }
      ion-content { --background: var(--curtis-bg); }

      .stage {
        min-height: 100%;
        display: flex; flex-direction: column;
        padding: 1.25rem;
      }

      .step-progress {
        display: flex; gap: 0.4rem;
        margin: 0.5rem 0 1.5rem;
      }
      .dot {
        flex: 1; height: 4px;
        background: var(--curtis-border);
        border-radius: 2px;
        transition: background 200ms ease-out;
      }
      .dot.active { background: var(--ion-color-primary); }

      .hero {
        text-align: center;
        margin-top: 1rem;
      }
      .hero .icon-wrap {
        width: 92px; height: 92px;
        margin: 0 auto 1rem;
        border-radius: 24px;
        display: grid; place-items: center;
        background: var(--curtis-gradient-primary);
        box-shadow: var(--curtis-shadow-md);
      }
      .hero .icon-wrap ion-icon {
        font-size: 2.6rem;
        color: var(--ion-color-tertiary);
      }
      .hero h1 {
        font-size: 1.5rem; font-weight: 800;
        letter-spacing: -0.01em;
        margin: 0;
        color: var(--curtis-text);
      }
      .hero p {
        margin: 0.75rem auto 0;
        max-width: 30rem;
        color: var(--curtis-text-muted);
        font-size: 0.92rem;
        line-height: 1.5;
      }

      .points {
        margin: 1.75rem 0 1rem;
        padding: 1rem;
        background: var(--curtis-surface-1);
        border: 1px solid var(--curtis-border);
        border-radius: var(--curtis-radius-lg);
        box-shadow: var(--curtis-shadow-sm);
      }
      .point {
        display: flex; gap: 0.75rem;
        padding: 0.6rem 0;
        border-bottom: 1px solid var(--curtis-border);
      }
      .point:last-child { border-bottom: none; }
      .point ion-icon {
        flex-shrink: 0;
        font-size: 1.4rem;
        color: var(--ion-color-tertiary);
        margin-top: 0.1rem;
      }
      .point .text { font-size: 0.88rem; line-height: 1.45; }
      .point .text strong { display: block; margin-bottom: 0.15rem; font-weight: 700; }
      .point .text span { color: var(--curtis-text-muted); }

      .actions {
        margin-top: auto;
        padding: 1.25rem 0 0.5rem;
        display: grid; gap: 0.5rem;
      }
    `,
  ],
  template: `
    <ion-content [fullscreen]="true">
      <div class="stage">
        <div class="step-progress">
          @for (s of steps(); let i = $index; track s.id) {
            <span class="dot" [class.active]="i <= stepIndex()"></span>
          }
        </div>

        @if (currentStep(); as step) {
          <div class="hero">
            <div class="icon-wrap">
              <ion-icon [name]="step.icon" />
            </div>
            <h1>{{ step.title }}</h1>
            <p>{{ step.body }}</p>
          </div>

          @if (step.id === 'welcome') {
            <div class="points">
              <div class="point">
                <ion-icon name="navigate-circle-outline" />
                <div class="text">
                  <strong>Live route tracking</strong>
                  <span>Your truck location is shared with dispatch every 30 seconds while you're on shift. A persistent notification confirms it's running.</span>
                </div>
              </div>
              <div class="point">
                <ion-icon name="cloud-upload-outline" />
                <div class="text">
                  <strong>Offline-safe</strong>
                  <span>Drop signal? Reports and scans queue up and sync automatically when connection returns. You'll see a status badge if anything's pending.</span>
                </div>
              </div>
              <div class="point">
                <ion-icon name="notifications-outline" />
                <div class="text">
                  <strong>Dispatch alerts</strong>
                  <span>Route changes, urgent messages, and SOS confirmations arrive as push notifications — no need to keep the app open.</span>
                </div>
              </div>
            </div>
          }

          @if (step.id === 'battery' && isAndroid()) {
            <div class="points">
              <div class="point">
                <ion-icon name="warning-outline" />
                <div class="text">
                  <strong>Why this matters</strong>
                  <span>By default, Android may stop CurTIS from running in the background to save battery. For cash-in-transit safety, the tracking service needs to stay active throughout your shift.</span>
                </div>
              </div>
              <div class="point">
                <ion-icon name="checkmark-circle-outline" />
                <div class="text">
                  <strong>What to do</strong>
                  <span>Tap "Open settings" below. On the next screen, find CurTIS and select "Don't optimise" (or "Allow background activity" — wording varies by device).</span>
                </div>
              </div>
            </div>
          }

          <div class="actions">
            @if (step.cta) {
              <ion-button expand="block" (click)="runCta(step.cta)">
                <ion-icon slot="start" name="settings-outline" />
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
                <ion-icon slot="end" name="arrow-forward-outline" />
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

  /**
   * Step list — iOS only sees step 1 (welcome). Android sees both.
   * We compute this once at construction so it's stable across renders.
   */
  protected readonly steps = signal<OnboardingStep[]>(this.buildSteps());

  protected readonly currentStep = computed(() => this.steps()[this.stepIndex()] ?? null);
  protected readonly isLastStep = computed(() => this.stepIndex() === this.steps().length - 1);

  async ngOnInit(): Promise<void> {
    // Safety net: if someone hits /onboarding while not authenticated,
    // bounce them to login.
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
    try {
      await cta.action();
    } catch {
      // CTA failures are non-fatal — the agent can still continue.
    }
  }

  private async complete(): Promise<void> {
    await this.onboarding.markComplete();
    // Fire push registration here too — covers the case where the agent
    // logged in via the LoginPage but rejected the OS prompt then; this
    // gives them a second chance.
    void this.push.register().catch(() => undefined);
    await this.router.navigateByUrl('/dashboard', { replaceUrl: true });
  }

  private buildSteps(): OnboardingStep[] {
    const steps: OnboardingStep[] = [
      {
        id: 'welcome',
        icon: 'shield-checkmark-outline',
        title: 'Welcome to CurTIS',
        body:
          "You're set up. Here's what CurTIS does in the background once your day starts.",
      },
    ];
    if (Capacitor.getPlatform() === 'android') {
      steps.push({
        id: 'battery',
        icon: 'battery-charging-outline',
        title: 'One quick setup step',
        body:
          'Allow CurTIS to run without battery restrictions so location tracking stays active throughout your shift.',
        cta: {
          label: 'Open battery settings',
          action: async () => {
            const opened = await this.onboarding.openBatterySettings();
            if (!opened) {
              const t = await this.toast.create({
                message:
                  "Couldn't open settings directly. Open your phone's Settings app and search for 'battery optimisation' or 'background activity'.",
                duration: 4500,
                position: 'top',
                color: 'warning',
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
