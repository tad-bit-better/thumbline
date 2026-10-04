import type { Arrangement, Voicing } from '@thumbline/engine';
import { ChordDiagram } from './ChordDiagram';
import styles from './diagram.module.css';

/** Every shape the sheet uses, in order of appearance. */
export function ChordShapes({ arrangement, className }: { arrangement: Arrangement; className?: string }) {
  const shapes = new Map<string, Voicing>();
  for (const m of arrangement.chordMarks) if (!shapes.has(m.voicing.name)) shapes.set(m.voicing.name, m.voicing);
  return (
    <ul aria-label="Chord shapes" className={[styles['shapes'], className].filter(Boolean).join(' ')}>
      {[...shapes.values()].map((v) => (
        <li key={v.name} className={styles['shape']}>
          <ChordDiagram voicing={v} />
        </li>
      ))}
    </ul>
  );
}
