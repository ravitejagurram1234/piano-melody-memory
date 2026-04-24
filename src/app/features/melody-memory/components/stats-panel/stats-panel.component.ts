import {
  Component,
  ChangeDetectionStrategy,
  Input,
} from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * StatsPanelComponent — read-only summary of the current round's numbers.
 * Pure presentational, no services, no state of its own.
 */
@Component({
  selector: 'app-stats-panel',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stats">
      <div class="stats__item">
        <span class="stats__label">Current length</span>
        <span class="stats__value">{{ currentLength }}</span>
      </div>
      <div class="stats__sep"></div>
      <div class="stats__item">
        <span class="stats__label">Session best</span>
        <span class="stats__value">{{ sessionBest }}</span>
      </div>
      <div class="stats__sep"></div>
      <div class="stats__item">
        <span class="stats__label">Level best</span>
        <span class="stats__value">{{ levelBest }}</span>
      </div>
      <div class="stats__sep"></div>
      <div class="stats__item">
        <span class="stats__label">All-time best</span>
        <span class="stats__value stats__value--accent">{{ allTimeBest }}</span>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .stats {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      gap: var(--spacing-md);
      padding: var(--spacing-md) var(--spacing-lg);
      background: linear-gradient(180deg, var(--color-surface-2), var(--color-surface));
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-md);
    }

    .stats__item {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 80px;
      gap: 2px;
    }

    .stats__label {
      font-size: 10.5px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-muted);
    }

    .stats__value {
      font-family: var(--font-mono);
      font-size: 24px;
      font-weight: 700;
      color: var(--color-text-primary);

      &--accent { color: var(--color-accent); }
    }

    .stats__sep {
      width: 1px;
      height: 28px;
      background: var(--color-border);
    }

    @media (max-width: 560px) {
      .stats__sep { display: none; }
    }
  `],
})
export class StatsPanelComponent {
  @Input() currentLength = 0;
  @Input() sessionBest   = 0;
  @Input() levelBest     = 0;
  @Input() allTimeBest   = 0;
}
