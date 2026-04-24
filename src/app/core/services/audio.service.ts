import { Injectable } from '@angular/core';

import { Note } from '../../shared/models/note.model';

/**
 * AudioService — Piano synthesis via Web Audio API.
 *
 * Uses additive synthesis with multiple harmonics and ADSR envelopes to
 * produce a piano-like timbre. Exposes helpers for single notes, chord
 * fanfares, error tones, and — specific to Melody Memory — playing a
 * timed sequence of notes that resolves to a Promise when finished.
 */
@Injectable({ providedIn: 'root' })
export class AudioService {
  private ctx: AudioContext | null = null;

  // ── Context lifecycle ────────────────────────────────────────────────────────

  private getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // ── Internal helpers ─────────────────────────────────────────────────────────

  private createHarmonicOscillator(
    ctx: AudioContext,
    destination: AudioNode,
    frequency: number,
    gainAmount: number,
    type: OscillatorType,
    duration: number,
    startOffset = 0,
  ): void {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(destination);

    osc.type = type;
    const startTime = ctx.currentTime + startOffset;
    osc.frequency.setValueAtTime(frequency, startTime);

    // Piano-style ADSR: near-instant attack, quick decay to lower sustain, long release
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(gainAmount, startTime + 0.006);
    gain.gain.exponentialRampToValueAtTime(gainAmount * 0.45, startTime + 0.08);
    gain.gain.exponentialRampToValueAtTime(gainAmount * 0.25, startTime + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  private playFrequency(
    frequency: number,
    duration: number,
    masterGain: number,
    startOffset = 0,
  ): void {
    const ctx    = this.getContext();
    const master = ctx.createGain();
    master.gain.setValueAtTime(masterGain, ctx.currentTime);
    master.connect(ctx.destination);

    // Harmonic series approximating a piano's resonance
    const harmonics: Array<{ mult: number; gain: number; type: OscillatorType }> = [
      { mult: 1,  gain: 1.00,  type: 'triangle' },
      { mult: 2,  gain: 0.55,  type: 'sine'     },
      { mult: 3,  gain: 0.28,  type: 'sine'     },
      { mult: 4,  gain: 0.14,  type: 'sine'     },
      { mult: 5,  gain: 0.08,  type: 'sine'     },
      { mult: 6,  gain: 0.05,  type: 'sine'     },
      { mult: 8,  gain: 0.03,  type: 'sine'     },
      { mult: 10, gain: 0.015, type: 'sine'     },
    ];

    harmonics.forEach(({ mult, gain, type }) => {
      this.createHarmonicOscillator(ctx, master, frequency * mult, gain, type, duration, startOffset);
    });
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Play a single piano note at the given frequency.
   * Long default duration for a natural, sustaining tone.
   */
  playNote(frequency: number, duration = 2.5): void {
    this.playFrequency(frequency, duration, 0.55);
  }

  /**
   * Play a single note in response to a user key press.
   * Shorter duration and slightly lower gain so multiple quick presses
   * don't pile up or clip.
   */
  playKey(note: Note, duration = 0.9): void {
    this.playFrequency(note.frequency, duration, 0.45);
  }

  /**
   * Play a timed sequence of notes (one after another).
   *
   * @param notes   Notes to play in order.
   * @param gapMs   Milliseconds between successive note onsets (the gap
   *                between when note N starts and note N+1 starts).
   * @param noteDurationMs  How long each individual note rings. Defaults
   *                to slightly longer than the gap so notes blend a bit.
   * @returns A Promise that resolves ~tailMs after the last note ends.
   */
  playSequence(
    notes: readonly Note[],
    gapMs = 550,
    noteDurationMs = 900,
  ): Promise<void> {
    if (notes.length === 0) return Promise.resolve();

    const durationSec = noteDurationMs / 1000;
    notes.forEach((n, i) => {
      const startOffset = (i * gapMs) / 1000;
      this.playFrequency(n.frequency, durationSec, 0.55, startOffset);
    });

    // Resolve after the final note's attack + its full ring, with a tiny tail.
    const totalMs = (notes.length - 1) * gapMs + noteDurationMs + 60;
    return new Promise((resolve) => setTimeout(resolve, totalMs));
  }

  /**
   * Play a short ascending arpeggio chord to celebrate a correct guess.
   */
  playSuccessChord(): void {
    // C5 – E5 – G5 – C6  (ascending major arpeggio)
    const freqs = [523.25, 659.25, 783.99, 1046.50];
    freqs.forEach((f, i) => {
      setTimeout(() => this.playNote(f, 0.45), i * 130);
    });
  }

  /**
   * Play a short low-pitch descending tone for an incorrect guess.
   */
  playErrorTone(): void {
    const ctx  = this.getContext();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.35);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.45);
  }

  /** Suspend the AudioContext (e.g., when tab loses focus) to save resources. */
  suspend(): void {
    this.ctx?.suspend();
  }
}
