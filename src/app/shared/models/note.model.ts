/**
 * Note Model — Basic note types and frequency math.
 *
 * Frequency formula (equal temperament):
 *   f(note, octave) = 261.626 × 2^((octave − 4) + semitone/12)
 * where semitone is 0 for C, 1 for C#, …, 11 for B.
 */

export const CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export type NoteName = typeof CHROMATIC_NOTES[number];

export interface Note {
  readonly name: string;
  readonly octave: number;
  readonly frequency: number;
  readonly displayName: string;
  readonly semitone: number;
}

/** Calculate frequency for a given note name and octave. */
export function getNoteFrequency(noteName: string, octave: number): number {
  const semitone = CHROMATIC_NOTES.indexOf(noteName as NoteName);
  return 261.626 * Math.pow(2, (octave - 4) + semitone / 12);
}

/** Build a Note from name and octave. */
export function buildNote(noteName: string, octave: number): Note {
  const semitone = CHROMATIC_NOTES.indexOf(noteName as NoteName);
  return {
    name:        noteName,
    octave,
    frequency:   getNoteFrequency(noteName, octave),
    displayName: `${noteName}${octave}`,
    semitone,
  };
}

/**
 * Build a Note from an absolute semitone index, where 0 is C0.
 * Example: semitoneIndex 48 = C4 (middle C).
 */
export function buildNoteFromSemitone(semitoneIndex: number): Note {
  const octave   = Math.floor(semitoneIndex / 12);
  const semitone = semitoneIndex % 12;
  const name     = CHROMATIC_NOTES[semitone];
  return buildNote(name, octave);
}

/** Return absolute semitone index for a note (0 = C0, 48 = C4). */
export function getSemitoneIndex(note: Note): number {
  return note.octave * 12 + note.semitone;
}

/** Return true if the given note is a black key (sharp). */
export function isBlackKey(note: Note): boolean {
  return note.name.includes('#');
}
