import type { Arrangement } from '@thumbline/engine';
import { Reveal, useReducedMotion } from '@thumbline/ui';
import { memo, useEffect, useMemo, useRef } from 'react';
import { GEOMETRY, type SheetLayout, type SystemLayout, layoutSheet } from '../layout/layout';
import styles from './TabSheet.module.css';
import { Technique } from './Techniques';

const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];
const FINGER_Y = GEOMETRY.stringTop + 5 * GEOMETRY.stringGap + GEOMETRY.fingerLane - 4;
const CHORD_Y = GEOMETRY.chordLane - 10;
const PLAYHEAD_TOP = GEOMETRY.stringTop - 14;
const PLAYHEAD_BOTTOM = GEOMETRY.stringTop + 5 * GEOMETRY.stringGap + 14;

export type TabSheetProps = {
  arrangement: Arrangement;
  /** Available width in px; systems wrap 1–4 bars to fit, scrolling below one bar. */
  width: number;
  /** Index into `arrangement.events` of the note being played. */
  cursorIndex?: number;
  showFingers?: boolean;
  showTechniques?: boolean;
  /** Pop the notes in when the style, level or pattern changes (moment #5). */
  reveal?: boolean;
  /** Name of the scrollable tab region. */
  label?: string;
  className?: string;
};

function systemLabel(s: SystemLayout) {
  const bars = s.barCount > 1 ? `Bars ${s.firstBar + 1}–${s.firstBar + s.barCount}` : `Bar ${s.firstBar + 1}`;
  return `${bars}: ${s.chords.map((c) => c.name).join(', ')}`;
}

type SystemViewProps = {
  system: SystemLayout;
  layout: SheetLayout;
  showFingers: boolean;
  showTechniques: boolean;
  revealKey: string | null;
  /** Only the system holding the playhead gets these, so the others don't re-render. */
  playheadX?: number;
  activeTick?: number;
  arrangement: Arrangement;
  glow: boolean;
};

const SystemView = memo(function SystemView({
  system: s,
  layout,
  showFingers,
  showTechniques,
  revealKey,
  playheadX,
  activeTick,
  arrangement,
  glow,
}: SystemViewProps) {
  const stringEnd = s.barLines[s.barLines.length - 1];
  const notes = s.notes.map((n) => {
    const w = n.text.length * 7.8 + 6;
    const active = activeTick !== undefined && arrangement.events[n.eventIndex].tick === activeTick;
    return (
      <g
        key={n.eventIndex}
        className={styles['note']}
        data-note=""
        data-bass={n.bass ? '' : undefined}
        data-active={active ? '' : undefined}
      >
        <rect className={styles['chip']} x={n.x - w / 2} y={n.y - 8} width={w} height={16} rx={n.bass ? 5 : 2} />
        <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="central">
          {n.text}
        </text>
      </g>
    );
  });

  return (
    <svg
      className={styles['system']}
      width={layout.width}
      height={GEOMETRY.systemHeight}
      viewBox={`0 0 ${layout.width} ${GEOMETRY.systemHeight}`}
      role="img"
      aria-label={systemLabel(s)}
      data-system={s.index}
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
          <line className={styles['string']} x1={GEOMETRY.left} x2={stringEnd} y1={y} y2={y} strokeWidth={0.8 + (5 - string) * 0.16} />
        </g>
      ))}
      {s.barLines.map((x) => (
        <line key={x} className={styles['barline']} x1={x} x2={x} y1={s.stringY[5]} y2={s.stringY[0]} />
      ))}

      {playheadX !== undefined && (
        <g className={styles['playhead']} style={{ transform: `translateX(${playheadX}px)` }} data-playhead="">
          {glow && <line className={styles['glow']} x1={0} x2={0} y1={PLAYHEAD_TOP} y2={PLAYHEAD_BOTTOM} data-playhead-glow="" />}
          <line className={styles['line']} x1={0} x2={0} y1={PLAYHEAD_TOP} y2={PLAYHEAD_BOTTOM} />
        </g>
      )}

      {showTechniques && s.techniques.map((m, i) => <Technique key={i} mark={m} colWidth={layout.colWidth} />)}

      {revealKey === null ? (
        <g>{notes}</g>
      ) : (
        <Reveal as="g" revealKey={revealKey}>
          {notes}
        </Reveal>
      )}

      {showFingers &&
        s.fingers.map((f) => (
          <text key={f.x} className={styles['finger']} x={f.x} y={FINGER_Y} textAnchor="middle" data-finger="">
            {f.text}
          </text>
        ))}
    </svg>
  );
});

/** The tab: chord names, techniques, six strings (high e on top), right-hand fingers and the playhead. */
export function TabSheet({
  arrangement,
  width,
  cursorIndex,
  showFingers = true,
  showTechniques = true,
  reveal = true,
  label = 'Tab',
  className,
}: TabSheetProps) {
  const layout = useMemo(() => layoutSheet(arrangement, width), [arrangement, width]);
  const reduced = useReducedMotion();
  const sheetRef = useRef<HTMLDivElement>(null);

  const cursor = cursorIndex === undefined ? undefined : layout.positions[cursorIndex];
  const activeTick = cursor ? arrangement.events[cursorIndex as number].tick : undefined;
  const revealKey = reveal ? `${arrangement.style}:${arrangement.level}:${arrangement.patternId}` : null;

  // Keep the playing system in view; only when it changes, not on every note.
  const cursorSystem = cursor?.system;
  const lastSystem = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (cursorSystem === undefined || cursorSystem === lastSystem.current) return;
    const first = lastSystem.current === undefined;
    lastSystem.current = cursorSystem;
    if (first) return;
    sheetRef.current
      ?.querySelector(`[data-system="${cursorSystem}"]`)
      ?.scrollIntoView?.({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  }, [cursorSystem, reduced]);

  if (!layout.systems.length) return null;

  return (
    // Focusable so keyboard users can scroll a sheet wider than its container.
    <div
      ref={sheetRef}
      role="region"
      aria-label={label}
      tabIndex={0}
      className={[styles['sheet'], className].filter(Boolean).join(' ')}
      data-reduced-motion={reduced ? '' : undefined}
    >
      {layout.systems.map((s) => {
        const here = cursor?.system === s.index;
        return (
          <SystemView
            key={s.index}
            system={s}
            layout={layout}
            showFingers={showFingers}
            showTechniques={showTechniques}
            revealKey={revealKey}
            playheadX={here ? cursor?.x : undefined}
            activeTick={here ? activeTick : undefined}
            arrangement={arrangement}
            glow={!reduced}
          />
        );
      })}
    </div>
  );
}
