import type { Arrangement, ChordMark } from '@thumbline/engine';
import { ChordDiagram } from './ChordDiagram';
import styles from './diagram.module.css';

export type ChordShapesProps = {
  arrangement: Arrangement;
  /** `grid`: diagrams in a row (default). `list`: one per row with what it sounds like and its notes (a side rail). */
  variant?: 'grid' | 'list';
  className?: string;
};

/** Every shape the sheet uses, in order of appearance. */
export function ChordShapes({ arrangement, variant = 'grid', className }: ChordShapesProps) {
  const shapes = new Map<string, ChordMark>();
  for (const m of arrangement.chordMarks) if (!shapes.has(m.voicing.name)) shapes.set(m.voicing.name, m);
  const list = variant === 'list';
  return (
    <ul aria-label="Chord shapes" className={[styles[list ? 'shapeList' : 'shapes'], className].filter(Boolean).join(' ')}>
      {[...shapes.values()].map((m) => {
        const v = m.voicing;
        const sounds = arrangement.capo > 0 && m.soundingName !== v.name ? m.soundingName : undefined;
        return (
          <li key={v.name} className={styles[list ? 'shapeRow' : 'shape']}>
            <ChordDiagram voicing={v} size={list ? 64 : undefined} />
            {list && (
              <div className={styles['shapeNotes']}>
                {sounds && <span className={styles['shapeSounds']}>sounds {sounds}</span>}
                {(v.barre || v.simplified) && (
                  <span className={styles['shapeBadges']}>
                    {v.barre && <span className={styles['badge']}>Barre</span>}
                    {v.simplified && <span className={styles['badge']}>Simplified</span>}
                  </span>
                )}
                {v.simplified && <span className={styles['shapeNote']}>Easier than {v.simplified.from}.</span>}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
