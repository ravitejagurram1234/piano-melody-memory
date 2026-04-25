import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  trigger,
  style,
  animate,
  transition,
  keyframes,
} from '@angular/animations';

import { AudioService } from '../../core/services/audio.service';
import { ProgressService } from '../../core/services/progress.service';

import {
  Level,
  LevelId,
  getLevel,
  isLevelId,
  keyboardNotesForLevel,
  pickRandomNoteForLevel,
  poolSize,
} from '../../shared/models/level.model';
import { Note } from '../../shared/models/note.model';

import { PianoKeyboardComponent } from './components/piano-keyboard/piano-keyboard.component';
import { StatsPanelComponent } from './components/stats-panel/stats-panel.component';
import { SuccessBurstComponent } from './components/success-burst/success-burst.component';

// ── Timing constants ─────────────────────────────────────────────────────────

const GAP_MS           = 550;  // between notes during "listening" playback
const NOTE_RING_MS     = 900;  // how long an app-played note rings
const LAST_NOTE_TAIL   = 220;  // extra pause after final note before user's turn
const USER_FLASH_MS    = 280;  // how long user's own key press stays lit
const SUCCESS_HOLD_MS  = 1600; // how long the celebration shows before next round
const FAIL_HOLD_MS     = 2000; // how long the fail state holds before returning to idle
const HINT_FLASH_MS    = 900;  // amber hint flash after a miss (retry available)

type GamePhase = 'idle' | 'listening' | 'replaying' | 'success' | 'fail';

interface RoundSnapshot {
  lengthReached: number;
  sequencesCompleted: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Component({
  selector: 'app-melody-memory',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    PianoKeyboardComponent,
    StatsPanelComponent,
    SuccessBurstComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './melody-memory.component.html',
  styleUrl: './melody-memory.component.scss',
  animations: [
    trigger('fadeSlideIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-8px)' }),
        animate('260ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
    trigger('shake', [
      transition('false => true', [
        animate(
          '500ms ease',
          keyframes([
            style({ transform: 'translateX(0)',     offset: 0    }),
            style({ transform: 'translateX(-10px)', offset: 0.15 }),
            style({ transform: 'translateX(10px)',  offset: 0.30 }),
            style({ transform: 'translateX(-8px)',  offset: 0.45 }),
            style({ transform: 'translateX(8px)',   offset: 0.60 }),
            style({ transform: 'translateX(-4px)',  offset: 0.75 }),
            style({ transform: 'translateX(4px)',   offset: 0.88 }),
            style({ transform: 'translateX(0)',     offset: 1    }),
          ])
        ),
      ]),
    ]),
    trigger('popIn', [
      transition(':enter', [
        style({ transform: 'scale(0.85)', opacity: 0 }),
        animate('300ms cubic-bezier(0.34, 1.56, 0.64, 1)', style({ transform: 'scale(1)', opacity: 1 })),
      ]),
    ]),
  ],
})
export class MelodyMemoryComponent implements OnInit, OnDestroy {
  private readonly audio    = inject(AudioService);
  private readonly progress = inject(ProgressService);
  private readonly route    = inject(ActivatedRoute);
  private readonly router   = inject(Router);

  // ── Level ────────────────────────────────────────────────────────────────────

  readonly level = signal<Level | null>(null);
  readonly keyboardNotes = signal<readonly Note[]>([]);

  // ── Game state ──────────────────────────────────────────────────────────────

  readonly gamePhase = signal<GamePhase>('idle');
  readonly sequence = signal<Note[]>([]);
  readonly userIndex = signal(0);
  readonly retryAvailable = signal(true);

  /** Key currently lit in accent colour (app playback OR correct user press). */
  readonly activeKey = signal<string | null>(null);
  /** Key flashing in red — set briefly when the user presses a wrong note. */
  readonly errorKey = signal<string | null>(null);
  /** Key flashing in amber — the correct note the user should have played. */
  readonly hintKey = signal<string | null>(null);

  readonly isShaking = signal(false);
  readonly showSuccess = signal(false);

  readonly sessionBest = signal(0);
  readonly sequencesCompletedThisRound = signal(0);
  readonly lengthReachedThisRound = signal(0);

  /** Brief status strings that surface above the keyboard. */
  readonly statusLabel = computed<string>(() => {
    switch (this.gamePhase()) {
      case 'idle':      return this.sequence().length === 0
        ? 'Press Start to hear your first note.'
        : 'Press Start to try a new round.';
      case 'listening': return 'Listen…';
      case 'replaying': {
        const total = this.sequence().length;
        const pos   = this.userIndex() + 1;
        const retry = this.retryAvailable() ? '' : ' — last chance on this note';
        return `Your turn: note ${pos} of ${total}${retry}`;
      }
      case 'success': return 'Nice! Extending the melody…';
      case 'fail':    return 'Round over. Press Start to try again.';
    }
  });

  readonly canStart       = computed(() => this.gamePhase() === 'idle' || this.gamePhase() === 'fail');
  readonly canReplay      = computed(() => this.gamePhase() === 'replaying');
  readonly canGiveUp      = computed(() =>
    this.gamePhase() === 'listening' || this.gamePhase() === 'replaying'
  );
  readonly keyboardDisabled = computed(() =>
    this.gamePhase() === 'listening' || this.gamePhase() === 'success' || this.gamePhase() === 'fail'
  );

  // ── Abort mechanism ─────────────────────────────────────────────────────────

  /** Incremented whenever a running playback/round needs to be invalidated. */
  private playbackGen = 0;

  /** Pending timeouts we've scheduled for clearing visual flashes. */
  private pendingTimeouts: ReturnType<typeof setTimeout>[] = [];

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  ngOnInit(): void {
    const param = this.route.snapshot.paramMap.get('level');
    if (!isLevelId(param)) {
      this.router.navigate(['/']);
      return;
    }
    const level = getLevel(param);
    if (!level) {
      this.router.navigate(['/']);
      return;
    }

    this.level.set(level);
    this.keyboardNotes.set(keyboardNotesForLevel(level));
    this.progress.markLevelPlayed(level.id);

    const saved = this.progress.getLevelStats(level.id);
    this.sessionBest.set(0); // session scoped to this mounting of the component
    // Pre-populate displayed "level best" from saved stats indirectly via template
    void saved;
  }

  ngOnDestroy(): void {
    this.playbackGen++;
    this.clearPending();
    this.audio.suspend();
  }

  // ── Derived read-only values for the template ──────────────────────────────

  levelBest(): number {
    const l = this.level();
    return l ? this.progress.getLevelStats(l.id).bestLength : 0;
  }

  allTimeBest(): number {
    return this.progress.getAllTimeBest()?.length ?? 0;
  }

  poolSizeForLevel(): number {
    const l = this.level();
    return l ? poolSize(l) : 0;
  }

  // ── Public actions ─────────────────────────────────────────────────────────

  /** Start (or restart) a round. */
  start(): void {
    const l = this.level();
    if (!l) return;

    this.playbackGen++;
    this.clearPending();

    // Reset round state
    this.sequence.set([pickRandomNoteForLevel(l)]);
    this.userIndex.set(0);
    this.retryAvailable.set(true);
    this.sequencesCompletedThisRound.set(0);
    this.lengthReachedThisRound.set(0);
    this.activeKey.set(null);
    this.errorKey.set(null);
    this.hintKey.set(null);
    this.isShaking.set(false);
    this.showSuccess.set(false);

    // Begin the listen → replay cycle for the initial 1-note sequence.
    void this.runListenThenReplay();
  }

  /** Re-play the current sequence during the user's turn. */
  replaySequence(): void {
    if (this.gamePhase() !== 'replaying') return;

    // Reset the user's position and re-announce the sequence.
    this.userIndex.set(0);
    this.retryAvailable.set(true);
    this.errorKey.set(null);
    this.hintKey.set(null);
    void this.runListenThenReplay();
  }

  /** End the current round early. Records stats with whatever the user reached. */
  giveUp(): void {
    if (!this.canGiveUp()) return;

    this.playbackGen++;
    this.clearPending();
    this.activeKey.set(null);
    this.errorKey.set(null);
    this.hintKey.set(null);

    const snapshot: RoundSnapshot = {
      lengthReached:      this.lengthReachedThisRound(),
      sequencesCompleted: this.sequencesCompletedThisRound(),
    };
    this.recordRound(snapshot);

    this.gamePhase.set('idle');
  }

  /** Handle a user press on the piano keyboard. */
  onKeyPress(pressed: Note): void {
    const phase = this.gamePhase();

    // "Free play" outside of an active replay turn — just sound the note.
    if (phase !== 'replaying') {
      if (phase === 'idle' || phase === 'fail') {
        this.audio.playKey(pressed);
        this.flashActive(pressed.displayName, 180);
      }
      return;
    }

    const expected = this.sequence()[this.userIndex()];
    if (!expected) return;

    const isCorrect = pressed.displayName === expected.displayName;
    if (isCorrect) {
      this.onCorrectPress(pressed);
    } else {
      this.onWrongPress(pressed, expected);
    }
  }

  // ── Internal game mechanics ────────────────────────────────────────────────

  private async runListenThenReplay(): Promise<void> {
    const gen = ++this.playbackGen;
    this.gamePhase.set('listening');

    await sleep(250); // small pre-roll so the phase change settles

    // Keys deliberately do NOT light up during playback — the user has to
    // identify the notes by ear. Their own correct presses still flash, and
    // wrong presses still flash red/amber, but the listening phase is silent
    // visually.
    const notes = this.sequence();
    for (let i = 0; i < notes.length; i++) {
      if (this.playbackGen !== gen) return;

      const note = notes[i];
      this.audio.playKey(note, NOTE_RING_MS / 1000);

      await sleep(GAP_MS);
    }

    if (this.playbackGen !== gen) return;

    await sleep(LAST_NOTE_TAIL);
    if (this.playbackGen !== gen) return;

    this.activeKey.set(null);
    this.userIndex.set(0);
    this.retryAvailable.set(true);
    this.gamePhase.set('replaying');
  }

  private onCorrectPress(note: Note): void {
    this.audio.playKey(note);
    this.flashActive(note.displayName, USER_FLASH_MS);
    this.errorKey.set(null);
    this.hintKey.set(null);
    this.retryAvailable.set(true);

    const nextIndex = this.userIndex() + 1;
    const total     = this.sequence().length;

    if (nextIndex < total) {
      // Still more notes to reproduce in this sequence.
      this.userIndex.set(nextIndex);
      return;
    }

    // Full sequence reproduced — celebrate & extend.
    this.userIndex.set(nextIndex);
    this.sequencesCompletedThisRound.update((v) => v + 1);
    this.lengthReachedThisRound.set(total);
    this.sessionBest.update((b) => Math.max(b, total));

    this.gamePhase.set('success');
    this.showSuccess.set(true);
    this.audio.playSuccessChord();

    const t = setTimeout(() => this.extendAndContinue(), SUCCESS_HOLD_MS);
    this.pendingTimeouts.push(t);
  }

  private onWrongPress(pressed: Note, expected: Note): void {
    this.audio.playErrorTone();

    if (this.retryAvailable()) {
      // First miss at this position — one-shot retry.
      this.retryAvailable.set(false);
      this.errorKey.set(pressed.displayName);
      this.hintKey.set(expected.displayName);

      const clearError = setTimeout(() => {
        if (this.errorKey() === pressed.displayName) this.errorKey.set(null);
      }, HINT_FLASH_MS);
      const clearHint = setTimeout(() => {
        if (this.hintKey() === expected.displayName) this.hintKey.set(null);
      }, HINT_FLASH_MS);
      this.pendingTimeouts.push(clearError, clearHint);
      return;
    }

    // Second consecutive miss at this position — round ends.
    this.endRoundWithFail(pressed, expected);
  }

  private endRoundWithFail(pressed: Note, expected: Note): void {
    this.playbackGen++; // stop any pending playback
    this.gamePhase.set('fail');
    this.errorKey.set(pressed.displayName);
    this.hintKey.set(expected.displayName);
    this.isShaking.set(true);

    const stopShake = setTimeout(() => this.isShaking.set(false), 550);
    this.pendingTimeouts.push(stopShake);

    this.recordRound({
      lengthReached:      this.lengthReachedThisRound(),
      sequencesCompleted: this.sequencesCompletedThisRound(),
    });

    const backToIdle = setTimeout(() => {
      this.errorKey.set(null);
      this.hintKey.set(null);
    }, FAIL_HOLD_MS);
    this.pendingTimeouts.push(backToIdle);
  }

  private extendAndContinue(): void {
    this.showSuccess.set(false);
    const l = this.level();
    if (!l) return;

    const last    = this.sequence()[this.sequence().length - 1];
    const nextNote = pickRandomNoteForLevel(l, last);
    this.sequence.update((s) => [...s, nextNote]);
    this.userIndex.set(0);
    this.retryAvailable.set(true);

    void this.runListenThenReplay();
  }

  private recordRound(snapshot: RoundSnapshot): void {
    const l = this.level();
    if (!l) return;
    // Only record if the user actually started the round (i.e. at least one sequence played).
    // If they never reached even length 1, we still count the round so totalRounds reflects
    // every attempt. But bestLength is the max so a 0 reached won't change it.
    this.progress.recordRoundEnd(l.id, snapshot.lengthReached, snapshot.sequencesCompleted);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private flashActive(displayName: string, durationMs: number): void {
    this.activeKey.set(displayName);
    const t = setTimeout(() => {
      if (this.activeKey() === displayName) this.activeKey.set(null);
    }, durationMs);
    this.pendingTimeouts.push(t);
  }

  private clearPending(): void {
    for (const t of this.pendingTimeouts) clearTimeout(t);
    this.pendingTimeouts = [];
  }

  // ── Navigation helper ───────────────────────────────────────────────────────

  backToLevelSelect(): void {
    this.playbackGen++;
    this.clearPending();
    this.audio.suspend();
    this.router.navigate(['/']);
  }
}
