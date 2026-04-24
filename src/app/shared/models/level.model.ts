/**
 * Level Model — Three difficulty levels for Piano Melody Memory.
 *
 * Each level defines a semitone range (inclusive) and whether black keys
 * are part of the note pool. The keyboard component renders the full
 * semitone range (for visual continuity), but only the pool notes are
 * randomly chosen to extend the sequence.
 */

import {
  Note,
  buildNoteFromSemitone,
  isBlackKey,
} from './note.model';

// ── Types ─────────────────────────────────────────────────────────────────────

export type LevelId = 'beginner' | 'intermediate' | 'expert';

export interface Level {
  readonly id:             LevelId;
  readonly name:           string;
  readonly tagline:        string;
  readonly description:    string;
  /** Inclusive semitone range: [minSemitoneIndex, maxSemitoneIndex]. C4 = 48. */
  readonly semitoneRange:  readonly [number, number];
  /** Whether black keys are drawn from the pool when picking the next note. */
  readonly allowBlackKeys: boolean;
  /** Short summary used on the level card (e.g. "White keys · 1 octave"). */
  readonly rangeLabel:     string;
  /** CSS modifier string used to colour-code the card accent. */
  readonly accent:         LevelId;
}

// ── Semitone constants ────────────────────────────────────────────────────────

/** C4 = middle C = absolute semitone index 48. */
export const C4 = 4 * 12;        // 48
export const B4 = 4 * 12 + 11;   // 59
export const B5 = 5 * 12 + 11;   // 71

// ── Level catalog ─────────────────────────────────────────────────────────────

export const LEVELS: readonly Level[] = [
  {
    id:             'beginner',
    name:           'Beginner',
    tagline:        'One octave, white keys',
    description:    'Seven white keys from C4 to B4. Perfect for learning how the game works — build your first short melodies here.',
    semitoneRange:  [C4, B4],
    allowBlackKeys: false,
    rangeLabel:     'White keys · 1 octave',
    accent:         'beginner',
  },
  {
    id:             'intermediate',
    name:           'Intermediate',
    tagline:        'Two octaves, white keys',
    description:    'Fourteen white keys from C4 to B5. Bigger leaps, more melodies to remember, but still diatonic.',
    semitoneRange:  [C4, B5],
    allowBlackKeys: false,
    rangeLabel:     'White keys · 2 octaves',
    accent:         'intermediate',
  },
  {
    id:             'expert',
    name:           'Expert',
    tagline:        'Two octaves, chromatic',
    description:    'All 24 chromatic notes from C4 to B5 — including the sharps. Expect unexpected intervals.',
    semitoneRange:  [C4, B5],
    allowBlackKeys: true,
    rangeLabel:     'Chromatic · 2 octaves',
    accent:         'expert',
  },
] as const;

// ── Lookups ───────────────────────────────────────────────────────────────────

export function getLevel(id: string | null | undefined): Level | undefined {
  if (!id) return undefined;
  return LEVELS.find((l) => l.id === id);
}

/** Returns true if the string is one of the known level ids. */
export function isLevelId(value: unknown): value is LevelId {
  return value === 'beginner' || value === 'intermediate' || value === 'expert';
}

// ── Note-pool helpers ─────────────────────────────────────────────────────────

/** Every semitone in the level's range (always contiguous, used by the keyboard). */
export function keyboardNotesForLevel(level: Level): Note[] {
  const [min, max] = level.semitoneRange;
  const notes: Note[] = [];
  for (let i = min; i <= max; i++) {
    notes.push(buildNoteFromSemitone(i));
  }
  return notes;
}

/** Notes eligible to be picked by the sequence generator (may exclude black keys). */
export function poolNotesForLevel(level: Level): Note[] {
  return keyboardNotesForLevel(level).filter((n) => level.allowBlackKeys || !isBlackKey(n));
}

/**
 * Pick one random note from the level's pool, optionally avoiding a specific
 * note (e.g. the one just appended) so we don't produce trivial doubles.
 * If the pool has only a single note, the avoid parameter is ignored.
 */
export function pickRandomNoteForLevel(level: Level, avoid?: Note): Note {
  const pool = poolNotesForLevel(level);
  if (pool.length === 0) {
    throw new Error(`Level ${level.id} has no pool notes`);
  }
  let candidates = pool;
  if (avoid && pool.length > 1) {
    const avoidKey = avoid.displayName;
    const filtered = pool.filter((n) => n.displayName !== avoidKey);
    if (filtered.length > 0) candidates = filtered;
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/** How many notes are in the playable pool for the given level. */
export function poolSize(level: Level): number {
  return poolNotesForLevel(level).length;
}
