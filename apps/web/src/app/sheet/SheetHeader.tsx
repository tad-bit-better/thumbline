import type { AnalysisResult, Arrangement } from '@thumbline/engine';
import styles from './sheet.module.css';
import { KEYS, ordinal } from './sheet-labels';

export type SheetHeaderProps = {
  title: string;
  song: AnalysisResult;
  arrangement: Arrangement | null;
  playing: boolean;
  reduced: boolean;
};

/** "Your sheet", the song's name (with a little equaliser while it plays) and its facts: key, capo, time, tempo. */
export function SheetHeader({
  title,
  song,
  arrangement,
  playing,
  reduced,
}: SheetHeaderProps) {
  const capo = arrangement?.capo ?? 0;
  const shapeKey = capo > 0 ? KEYS[(song.key.pc - capo + 12) % 12] : null;
  return (
    <header className={styles.header}>
      <div className={styles.heading}>
        <p className={styles.eyebrow}>Your sheet</p>
        <h1 className={styles.title}>
          {title}
          {playing && (
            <span
              className={styles.eq}
              aria-hidden="true"
              data-reduced-motion={reduced ? '' : undefined}
            >
              <span />
              <span />
              <span />
            </span>
          )}
        </h1>
      </div>
      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt>Key</dt>
          <dd>
            {KEYS[song.key.pc]} {song.key.mode}
            {shapeKey && (
              <span className={styles.factNote}>shapes in {shapeKey}</span>
            )}
          </dd>
        </div>
        <div className={styles.fact}>
          <dt>Capo</dt>
          <dd>{capo > 0 ? `${ordinal(capo)} fret` : 'None'}</dd>
        </div>
        <div className={styles.fact}>
          <dt>Time</dt>
          <dd>{song.meter.beatsPerBar}/4</dd>
        </div>
        <div className={styles.fact}>
          <dt>Original tempo</dt>
          <dd>{Math.round(song.bpm)} bpm</dd>
        </div>
      </dl>
    </header>
  );
}
