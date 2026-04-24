import {
  Component,
  ChangeDetectionStrategy,
  Input,
} from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * SuccessBurstComponent — a brief confetti-like particle burst overlay.
 * Renders only when [visible] is true. Each particle is a small div
 * with a precomputed angle / distance driving a CSS custom-property
 * animation. Pure CSS, no DOM calculations on each frame.
 */
@Component({
  selector: 'app-success-burst',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible) {
      <div class="burst" aria-hidden="true">
        @for (p of particles; track p.id) {
          <span
            class="particle"
            [style.--angle.deg]="p.angle"
            [style.--distance.px]="p.distance"
            [style.--delay.ms]="p.delay"
            [style.--hue]="p.hue"
          ></span>
        }
      </div>
    }
  `,
  styles: [`
    :host {
      position: absolute;
      inset: 0;
      pointer-events: none;
      display: block;
      overflow: visible;
    }

    .burst {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .particle {
      position: absolute;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: hsl(var(--hue), 85%, 65%);
      box-shadow: 0 0 8px hsl(var(--hue), 85%, 65%);
      transform: translate(0, 0) scale(1);
      opacity: 0;
      animation: burst 900ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
      animation-delay: var(--delay);
    }

    @keyframes burst {
      0% {
        transform: translate(0, 0) scale(0.3);
        opacity: 1;
      }
      60% {
        opacity: 1;
      }
      100% {
        transform:
          translate(
            calc(cos(var(--angle) * 1deg) * var(--distance)),
            calc(sin(var(--angle) * 1deg) * var(--distance))
          )
          scale(0.5);
        opacity: 0;
      }
    }
  `],
})
export class SuccessBurstComponent {
  @Input() visible = false;

  readonly particles = Array.from({ length: 22 }, (_, id) => {
    // Deterministic spread so the burst feels consistent across triggers.
    const angle    = (id / 22) * 360 + (id % 2 === 0 ? 0 : 8);
    const distance = 80 + ((id * 13) % 40); // 80–120px
    const delay    = (id * 18) % 200;       // staggered 0–200ms
    const hueBase  = [210, 250, 170, 45, 290];
    const hue      = hueBase[id % hueBase.length] + ((id * 7) % 20);
    return { id, angle, distance, delay, hue };
  });
}
