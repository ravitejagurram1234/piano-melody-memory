import { Injectable } from '@angular/core';

import { LevelId, LEVELS } from '../../shared/models/level.model';

/**
 * ProgressService — localStorage-backed progress tracker for Melody Memory.
 *
 * Stores per-level stats for informational display only. Nothing is gated:
 * users can play any level at any time. If localStorage is unavailable, the
 * service falls back to an in-memory copy so the UI still works.
 */

export interface LevelStats {
  /** Longest sequence length ever successfully reproduced on this level. */
  bestLength: number;
  /** Total rounds played (one round = one Start → fail/give-up). */
  totalRounds: number;
  /** Total successfully reproduced sequences across all rounds on this level. */
  totalSequencesCompleted: number;
  /** Unix ms timestamp of the most recent round. */
  lastPlayedAt?: number;
}

export interface ProgressState {
  version: 1;
  lastPlayedLevel?: LevelId;
  perLevelStats: Partial<Record<LevelId, LevelStats>>;
}

export interface AllTimeBest {
  level: LevelId;
  length: number;
}

const STORAGE_KEY = 'melody-memory-v1';

function emptyState(): ProgressState {
  return {
    version: 1,
    perLevelStats: {},
  };
}

function emptyLevelStats(): LevelStats {
  return {
    bestLength: 0,
    totalRounds: 0,
    totalSequencesCompleted: 0,
  };
}

@Injectable({ providedIn: 'root' })
export class ProgressService {
  private state: ProgressState = emptyState();
  private storageAvailable = false;

  constructor() {
    this.storageAvailable = this.checkStorage();
    this.load();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  getState(): ProgressState {
    return this.state;
  }

  getLevelStats(levelId: LevelId): LevelStats {
    return this.state.perLevelStats[levelId] ?? emptyLevelStats();
  }

  getLastPlayedLevel(): LevelId | undefined {
    return this.state.lastPlayedLevel;
  }

  markLevelPlayed(levelId: LevelId): void {
    this.state.lastPlayedLevel = levelId;
    this.save();
  }

  /**
   * Record one completed round of gameplay.
   *
   * @param levelId              Which level the round was on.
   * @param lengthReached        Longest sequence reproduced in this round.
   * @param sequencesCompleted   Number of sequences reproduced in this round
   *                             (equals lengthReached when starting at length 1
   *                             and extending by one on each success).
   */
  recordRoundEnd(
    levelId: LevelId,
    lengthReached: number,
    sequencesCompleted: number,
  ): void {
    const existing = this.state.perLevelStats[levelId] ?? emptyLevelStats();

    const updated: LevelStats = {
      bestLength:              Math.max(existing.bestLength, lengthReached),
      totalRounds:             existing.totalRounds + 1,
      totalSequencesCompleted: existing.totalSequencesCompleted + sequencesCompleted,
      lastPlayedAt:            Date.now(),
    };

    this.state.perLevelStats[levelId] = updated;
    this.state.lastPlayedLevel = levelId;
    this.save();
  }

  /** Return the level-wide best across every level, or null if nothing played. */
  getAllTimeBest(): AllTimeBest | null {
    let best: AllTimeBest | null = null;
    for (const level of LEVELS) {
      const stats = this.state.perLevelStats[level.id];
      if (!stats || stats.bestLength <= 0) continue;
      if (!best || stats.bestLength > best.length) {
        best = { level: level.id, length: stats.bestLength };
      }
    }
    return best;
  }

  /** Reset stats for a specific level. */
  resetLevel(levelId: LevelId): void {
    delete this.state.perLevelStats[levelId];
    this.save();
  }

  /** Reset absolutely everything. */
  resetAll(): void {
    this.state = emptyState();
    this.save();
  }

  // ── Storage plumbing ───────────────────────────────────────────────────────

  private checkStorage(): boolean {
    try {
      const probeKey = '__melody_memory_probe__';
      window.localStorage.setItem(probeKey, '1');
      window.localStorage.removeItem(probeKey);
      return true;
    } catch {
      return false;
    }
  }

  private load(): void {
    if (!this.storageAvailable) return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ProgressState;
      if (parsed && parsed.version === 1 && parsed.perLevelStats) {
        this.state = parsed;
      }
    } catch {
      // Corrupt data — fall back to empty state
      this.state = emptyState();
    }
  }

  private save(): void {
    if (!this.storageAvailable) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Out of quota or similar — silently skip
    }
  }
}
