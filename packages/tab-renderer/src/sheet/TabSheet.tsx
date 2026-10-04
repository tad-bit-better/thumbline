import type { Arrangement } from '@thumbline/engine';
import { useMemo } from 'react';
import { GEOMETRY, type SystemLayout, layoutSheet } from '../layout/layout';
import styles from './TabSheet.module.css';
import { Technique } from './Techniques';

const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];
const FINGER_Y = GEOMETRY.stringTop + 5 * GEOMETRY.stringGap + GEOMETRY.fingerLane - 4;
const CHORD_Y = GEOMETRY.chordLane - 10;

export type TabSheetProps = {
  arrangement: Arrangement;
  /** Available width in px; systems wrap 1–4 bars to fit, scrolling below one bar. */
  width: number;
  showFingers?: boolean;
  showTechniques?: boolean;
  /** Name of the scrollable tab region. */
  label?: string;
  className?: string;
};

function systemLabel(s: SystemLayout) {
  const bars = s.barCount > 1 ? `Bars ${s.firstBar + 1}–${s.firstBar + s.barCount}` : `Bar ${s.firstBar + 1}`;
  return `${bars}: ${s.chords.map((c) => c.name).join(', ')}`;
}

/** The tab: chord names, techniques, six strings (high e on top) and right-hand fingers. */
export function TabSheet({ arrangement, width, showFingers = true, showTechniques = true, label = 'Tab', className }: TabSheetProps) {
  const layout = useMemo(() => layoutSheet(arrangement, width), [arrangement, width]);
  if (!layout.systems.length) return null;
  const stringEnd = (s: SystemLayout) => s.barLines[s.barLines.length - 1];

  return (
    // Focusable so keyboard users can scroll a sheet wider than its container.
    <div role="region" aria-label={label} tabIndex={0} className={[styles['sheet'], className].filter(Boolean).join(' ')}>
      {layout.systems.map((s) => (
        <svg
          key={s.index}
          className={styles['system']}
          width={layout.width}
          height={GEOMETRY.systemHeight}
          viewBox={`0 0 ${layout.width} ${GEOMETRY.systemHeight}`}
          role="img"
          aria-label={systemLabel(s)}
        >
          <text className={styles['barNumber']} x={2} y={CHORD_Y}>
            {s.firstBar + 1}
          </text>
          {s.chords.map((c) => (
            <text key={c.tick} className={styles['chord']} x={c.x} y={CHORD_Y} data-chord="">
              {c.name}
              {c.sounding && <tspan className={styles['sounding']}>({c.sounding})</tspan>}
            </text>
          ))}

          {s.stringY.map((y, string) => (
            <g key={string}>
              <text className={styles['stringName']} x={12} y={y} textAnchor="middle" dominantBaseline="central">
                {STRING_NAMES[string]}
              </text>
              <line className={styles['string']} x1={GEOMETRY.left} x2={stringEnd(s)} y1={y} y2={y} strokeWidth={0.8 + (5 - string) * 0.16} />
            </g>
          ))}
          {s.barLines.map((x) => (
            <line key={x} className={styles['barline']} x1={x} x2={x} y1={s.stringY[5]} y2={s.stringY[0]} />
          ))}

          {showTechniques && s.techniques.map((m, i) => <Technique key={i} mark={m} colWidth={layout.colWidth} />)}

          {s.notes.map((n) => {
            const w = n.text.length * 7.8 + 6;
            return (
              <g key={n.eventIndex} className={styles['note']} data-note="" data-bass={n.bass ? '' : undefined}>
                <rect className={styles['chip']} x={n.x - w / 2} y={n.y - 8} width={w} height={16} rx={n.bass ? 5 : 2} />
                <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="central">
                  {n.text}
                </text>
              </g>
            );
          })}

          {showFingers &&
            s.fingers.map((f) => (
              <text key={f.x} className={styles['finger']} x={f.x} y={FINGER_Y} textAnchor="middle" data-finger="">
                {f.text}
              </text>
            ))}
        </svg>
      ))}
    </div>
  );
}
