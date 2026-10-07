import { useState } from 'react';
import { PlayGlyph, StopGlyph } from '../glyphs';
import styles from './ChordPicker.module.css';

export type ChordChoice = {
  id: string;
  name: string;
  /** What a screen reader hears for the name; defaults to it. */
  spoken?: string;
  /** `heard`: our reading; `yours`: the reader's choice. */
  tag?: 'heard' | 'yours';
  /** 0..1, how strongly we heard it relative to the best (drawn as a bar). */
  strength: number;
};

export type ChordPickerProps = {
  /** e.g. "Bar 5". */
  title: string;
  /** One group per chord in the bar (a bar can change chord). */
  groups: Array<{ id: string; label?: string; choices: ChordChoice[] }>;
  onPick: (groupId: string, choiceId: string) => void;
  /** A chord we didn't suggest: a root and a type. */
  other?: {
    roots: readonly string[];
    qualities: ReadonlyArray<{ value: string; label: string }>;
    nameOf: (root: number, quality: string) => string;
    onPick: (groupId: string, root: number, quality: string) => void;
  };
  /** Play the bar in the original recording. */
  onHear?: () => void;
  hearing?: boolean;
  /** Move on to the next chord we're unsure of. */
  onNext?: () => void;
  nextLabel?: string;
};

const TAG = { heard: 'what we heard', yours: 'your choice' } as const;

/**
 * What a bar's chord could be: our suggestions (strongest first, with a bar
 * for how strongly we heard each), "Something else" for a root and type of the
 * reader's own, a button to hear the bar, and one to move to the next chord to
 * check. Lives inside a Popover on the sheet.
 */
export function ChordPicker({ title, groups, onPick, other, onHear, hearing = false, onNext, nextLabel = 'Next to check' }: ChordPickerProps) {
  const [otherFor, setOtherFor] = useState<string | null>(null);
  const [root, setRoot] = useState<number | null>(null);
  const [quality, setQuality] = useState<string>(other?.qualities[0]?.value ?? 'maj');
  return (
    <div className={styles['picker']}>
      <div className={styles['head']}>
        <b>{title}</b>
        {onHear && (
          <button type="button" className={styles['hear']} aria-pressed={hearing} onClick={onHear}>
            <span aria-hidden="true">{hearing ? <StopGlyph /> : <PlayGlyph />}</span>
            Hear this bar
          </button>
        )}
      </div>
      {groups.map((g) => (
        <div key={g.id} className={styles['group']} role="group" aria-label={g.label ?? title}>
          {g.label && <p className={styles['groupLabel']}>{g.label}</p>}
          {g.choices.map((c) => (
            <button
              key={c.id}
              type="button"
              className={styles['choice']}
              aria-label={`${c.spoken ?? c.name}${c.tag ? `, ${TAG[c.tag]}` : ''}`}
              data-tag={c.tag}
              onClick={() => onPick(g.id, c.id)}
            >
              <b>{c.name}</b>
              <span className={styles['strength']} aria-hidden="true">
                <span style={{ width: `${Math.round(Math.max(0.08, Math.min(1, c.strength)) * 100)}%` }} />
              </span>
              <span className={styles['tag']} aria-hidden="true">
                {c.tag === 'heard' ? 'heard' : c.tag === 'yours' ? 'yours' : ''}
              </span>
            </button>
          ))}
          {other &&
            (otherFor === g.id ? (
              <div className={styles['other']}>
                <p className={styles['groupLabel']}>Root</p>
                <div className={styles['roots']}>
                  {other.roots.map((r, i) => (
                    <button key={r} type="button" className={styles['pill']} aria-pressed={root === i} onClick={() => setRoot(i)}>
                      {r}
                    </button>
                  ))}
                </div>
                <p className={styles['groupLabel']}>Type</p>
                <div className={styles['qualities']}>
                  {other.qualities.map((q) => (
                    <button key={q.value} type="button" className={styles['pill']} aria-pressed={quality === q.value} onClick={() => setQuality(q.value)}>
                      {q.label}
                    </button>
                  ))}
                </div>
                <button type="button" className={styles['use']} disabled={root === null} onClick={() => root !== null && other.onPick(g.id, root, quality)}>
                  {root === null ? 'Pick a root' : `Use ${other.nameOf(root, quality)}`}
                </button>
              </div>
            ) : (
              <button type="button" className={styles['more']} onClick={() => setOtherFor(g.id)}>
                Something else
              </button>
            ))}
        </div>
      ))}
      {onNext && (
        <button type="button" className={styles['next']} onClick={onNext}>
          {nextLabel}
        </button>
      )}
    </div>
  );
}
