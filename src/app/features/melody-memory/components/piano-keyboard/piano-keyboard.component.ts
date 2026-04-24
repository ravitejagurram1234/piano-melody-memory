import {
  Component,
  ChangeDetectionStrategy,
  Input,
  Output,
  EventEmitter,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import {
  Note,
  isBlackKey,
  getSemitoneIndex,
} from '../../../../shared/models/note.model';

/**
 * A black key's position is expressed relative to the row of white keys,
 * using the index of the white key it sits to the right of.
 *
 *   whiteIndexLeft = 0 → this black key sits between white keys 0 and 1.
 */
interface BlackKeyLayout {
  readonly note: Note;
  readonly leftPct: number;   // left edge of the black key, in % of the keyboard width
  readonly widthPct: number;  // width of the black key, in % of the keyboard width
}

const BLACK_KEY_WIDTH_RATIO = 0.58; // fraction of a white key's width

@Component({
  selector: 'app-piano-keyboard',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './piano-keyboard.component.html',
  styleUrl: './piano-keyboard.component.scss',
})
export class PianoKeyboardComponent {
  /** Full set of notes (white + black) in the playable range. */
  @Input({ required: true })
  set notes(value: readonly Note[]) {
    this._notes.set([...value]);
  }
  get notes(): readonly Note[] {
    return this._notes();
  }

  /** displayName of the key currently "lit up" in the accent colour. */
  @Input() activeKey: string | null = null;

  /** displayName of the key the user pressed incorrectly — flashes red. */
  @Input() errorKey: string | null = null;

  /** displayName of the key to highlight as a corrective hint — flashes amber. */
  @Input() hintKey: string | null = null;

  /** If true, key-press events are ignored. */
  @Input() disabled = false;

  @Output() readonly keyPress = new EventEmitter<Note>();

  // ── Internal state ─────────────────────────────────────────────────────────

  private readonly _notes = signal<Note[]>([]);

  /** Only the white keys, in ascending order — form the flex row. */
  readonly whiteKeys = computed<Note[]>(() =>
    this._notes().filter((n) => !isBlackKey(n)),
  );

  /**
   * Black keys with precomputed layout (leftPct, widthPct).
   *
   * A black key sits to the right of some white key in the rendered row.
   * We find that white key by looking at the white key with the closest
   * lower semitone index, then compute the left offset as the boundary
   * between that white key and its right neighbour, shifted half a black
   * key's width to the left so the black key is centred on the seam.
   */
  readonly blackKeys = computed<BlackKeyLayout[]>(() => {
    const whites = this.whiteKeys();
    if (whites.length === 0) return [];

    const whiteWidthPct = 100 / whites.length;
    const blackWidthPct = whiteWidthPct * BLACK_KEY_WIDTH_RATIO;

    const layouts: BlackKeyLayout[] = [];
    const blacks = this._notes().filter(isBlackKey);

    for (const b of blacks) {
      const bIdx = getSemitoneIndex(b);
      // Find the last white key whose semitone index is less than the black key's.
      let leftWhiteIndex = -1;
      for (let i = 0; i < whites.length; i++) {
        if (getSemitoneIndex(whites[i]) < bIdx) {
          leftWhiteIndex = i;
        } else {
          break;
        }
      }
      // If the black key has no white key to its left (shouldn't happen for
      // our C-start ranges), skip it rather than rendering off-screen.
      if (leftWhiteIndex === -1) continue;

      const boundaryPct = (leftWhiteIndex + 1) * whiteWidthPct;
      const leftPct     = boundaryPct - blackWidthPct / 2;
      layouts.push({ note: b, leftPct, widthPct: blackWidthPct });
    }

    return layouts;
  });

  // ── Interaction ────────────────────────────────────────────────────────────

  onKeyPress(note: Note): void {
    if (this.disabled) return;
    this.keyPress.emit(note);
  }

  // ── Class helpers used from the template ───────────────────────────────────

  stateClass(note: Note): string {
    const name = note.displayName;
    if (this.errorKey === name) return 'key--error';
    if (this.hintKey  === name) return 'key--hint';
    if (this.activeKey === name) return 'key--active';
    return '';
  }
}
