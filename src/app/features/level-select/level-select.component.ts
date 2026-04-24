import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  trigger,
  style,
  animate,
  transition,
  stagger,
  query,
} from '@angular/animations';

import { LEVELS, Level, LevelId, poolSize } from '../../shared/models/level.model';
import { ProgressService, LevelStats, AllTimeBest } from '../../core/services/progress.service';

@Component({
  selector: 'app-level-select',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './level-select.component.html',
  styleUrl: './level-select.component.scss',
  animations: [
    trigger('cardsEnter', [
      transition(':enter', [
        query('.level-card', [
          style({ opacity: 0, transform: 'translateY(14px)' }),
          stagger(80, [
            animate('320ms cubic-bezier(0.34, 1.56, 0.64, 1)', style({ opacity: 1, transform: 'translateY(0)' })),
          ]),
        ], { optional: true }),
      ]),
    ]),
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-8px)' }),
        animate('260ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
  ],
})
export class LevelSelectComponent {
  private readonly progress = inject(ProgressService);

  readonly levels = LEVELS;
  readonly lastPlayed = signal<LevelId | undefined>(this.progress.getLastPlayedLevel());
  readonly allTimeBest = signal<AllTimeBest | null>(this.progress.getAllTimeBest());

  statsFor(level: Level): LevelStats {
    return this.progress.getLevelStats(level.id);
  }

  hasStats(level: Level): boolean {
    return this.statsFor(level).totalRounds > 0;
  }

  poolSizeFor(level: Level): number {
    return poolSize(level);
  }

  lastPlayedAgo(level: Level): string {
    const s = this.statsFor(level);
    if (!s.lastPlayedAt) return '';
    const diffSec = Math.floor((Date.now() - s.lastPlayedAt) / 1000);
    if (diffSec < 60)   return 'just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    const days = Math.floor(diffSec / 86400);
    return `${days}d ago`;
  }

  levelNameOf(id: LevelId): string {
    return LEVELS.find((l) => l.id === id)?.name ?? id;
  }

  hasAnyStats(): boolean {
    return this.levels.some((l) => this.hasStats(l));
  }

  resetAllConfirm(): void {
    if (confirm('Reset all saved progress across every level?')) {
      this.progress.resetAll();
      this.lastPlayed.set(undefined);
      this.allTimeBest.set(null);
    }
  }
}
