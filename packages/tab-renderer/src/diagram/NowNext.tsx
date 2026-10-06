import type { Arrangement, ChordMark } from '@thumbline/engine';
import { ChordDiagram } from './ChordDiagram';
import styles from './diagram.module.css';

export type NowNextProps = {
  arrangement: Arrangement;
  /** Where the playhead is (ticks); before the first chord, "now" is the first chord. */
  tick: number;
  /** Diagram size in px. */
  size?: number;
  className?: string;
};

/** The chord under the playhead and the next different one: what to hold, and what to get ready for. */
export function nowAndNext(arrangement: Arrangement, tick: number): { now?: ChordMark; next?: ChordMark } {
  const marks = arrangement.chordMarks;
  let i = -1;
  for (let k = 0; k < marks.length && marks[k].tick <= tick; k++) i = k;
  const now = marks[Math.max(0, i)];
  const next = marks.slice(Math.max(0, i) + 1).find((m) => m.voicing.name !== now?.voicing.name);
  return { now, next };
}

const sounds = (a: Arrangement, m: ChordMark) => (a.capo > 0 && m.soundingName !== m.voicing.name ? m.soundingName : undefined);

/** Now and next: two chord diagrams that follow the playhead (screens.md §4, right rail). */
export function NowNext({ arrangement, tick, size = 64, className }: NowNextProps) {
  const { now, next } = nowAndNext(arrangement, tick);
  if (!now) return null;
  const slot = (m: ChordMark | undefined, label: 'Now' | 'Next') => (
    <li className={styles['slot']} data-slot={label.toLowerCase()} aria-label={m ? `${label}: ${m.voicing.name}${sounds(arrangement, m) ? `, sounds ${sounds(arrangement, m)}` : ''}` : `${label}: none`}>
      <span className={styles['slotLabel']}>{label}</span>
      {m ? (
        <>
          <ChordDiagram voicing={m.voicing} size={size} />
          {sounds(arrangement, m) && <span className={styles['shapeSounds']}>sounds {sounds(arrangement, m)}</span>}
        </>
      ) : (
        <span className={styles['shapeSounds']}>End of the song</span>
      )}
    </li>
  );
  return (
    <ul aria-label="Now and next chords" className={[styles['nowNext'], className].filter(Boolean).join(' ')}>
      {slot(now, 'Now')}
      {slot(next, 'Next')}
    </ul>
  );
}
