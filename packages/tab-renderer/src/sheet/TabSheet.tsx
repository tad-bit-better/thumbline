import type { Arrangement } from '@thumbline/engine';
import { Reveal, useReducedMotion } from '@thumbline/ui';
import { type ReactNode, memo, useEffect, useMemo, useRef } from 'react';
import { GEOMETRY, type SheetLayout, type SystemLayout, layoutSheet, tickAtX } from '../layout/layout';
import styles from './TabSheet.module.css';
import { Technique } from './Techniques';

const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];
const FINGER_Y = GEOMETRY.stringTop + 5 * GEOMETRY.stringGap + GEOMETRY.fingerLane - 4;
const CHORD_Y = GEOMETRY.chordLane - 10;
const PLAYHEAD_TOP = GEOMETRY.stringTop - 14;
const PLAYHEAD_BOTTOM = GEOMETRY.stringTop + 5 * GEOMETRY.stringGap + 14;
/** Bar cards name their chords above the card, so the drawing starts below the chord lane. */
const CARD_CROP = GEOMETRY.chordLane - 6;
/** Card width to aim for at each tab size (px); the grid fits as many as the width allows. */
const CARD_TARGET = { s: 190, m: 240, l: 330 } as const;
/** Gap between cards and their padding (px): --space-3. */
const CARD_GAP = 12;
const CARD_PAD = 12;

export type ChordNameMode = 'shape' | 'sounding' | 'both';
export type TabSize = keyof typeof CARD_TARGET;
/** A run of bars shown under one heading in card mode. */
export type TabSection = { id: string; title: string; detail?: string; firstBar: number; bars: number };

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
  /** Click anywhere on the tab: the tick there (start of that column). */
  onSeek?: (tick: number) => void;
  /** Scroll the playing row into view when the playhead moves to a new row (default true). */
  follow?: boolean;
  /** Change it to bring the playing row into view now, wherever the reader is. */
  jumpKey?: number;
  /** Where the playing row is against the window: above it, in view, or below it. */
  onPlayheadView?: (where: PlayheadView) => void;
  /** Px at the bottom of the window covered by something (a sticky player bar): a row behind it isn't in view. */
  coveredBottom?: number;
  /** `lines`: systems of 1–4 bars. `cards`: one card per bar in a grid, under section headings. */
  variant?: 'lines' | 'cards';
  /** Card mode: headings over runs of bars. Without them the cards form one grid. */
  sections?: readonly TabSection[];
  /** What a chord is called under a capo: the shape you finger, what it sounds like, or both (default). */
  chordNames?: ChordNameMode;
  /** Card mode: how big each card is drawn (default m). */
  size?: TabSize;
  /** Card mode: wrap a card's chord names (0-based bar), e.g. in a button that changes them. */
  renderChords?: (bar: number, chords: ReactNode) => ReactNode;
  className?: string;
};

export type PlayheadView = 'above' | 'visible' | 'below';

function systemLabel(s: SystemLayout) {
  const bars = s.barCount > 1 ? `Bars ${s.firstBar + 1}–${s.firstBar + s.barCount}` : `Bar ${s.firstBar + 1}`;
  return `${bars}: ${s.chords.map((c) => c.name).join(', ')}`;
}

/** A chord as the reader asked to see it. */
function chordText(c: { name: string; sounding?: string }, mode: ChordNameMode) {
  if (mode === 'shape' || !c.sounding) return { main: c.name };
  if (mode === 'sounding') return { main: c.sounding };
  return { main: c.name, sounds: c.sounding };
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
  onSeek?: (tick: number) => void;
  chordNames: ChordNameMode;
  /** Card mode: no bar number or chord lane (the card heads them), and the drawing scales to the card. */
  card?: boolean;
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
  onSeek,
  chordNames,
  card = false,
}: SystemViewProps) {
  const top = card ? CARD_CROP : 0;
  const height = GEOMETRY.systemHeight - top;
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
        data-melody={n.melody ? '' : undefined}
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
      className={card ? styles['cardSystem'] : styles['system']}
      data-seekable={onSeek ? '' : undefined}
      onClick={
        onSeek &&
        ((e) => {
          // The SVG can be scaled by CSS: map the click back to layout units.
          const box = e.currentTarget.getBoundingClientRect();
          const x = (e.clientX - box.left) * (box.width ? layout.width / box.width : 1);
          // (card mode crops the top, not the sides: x maps the same way)
          const tick = tickAtX(layout, s, x);
          if (tick !== null) onSeek(tick);
        })
      }
      width={card ? undefined : layout.width}
      height={card ? undefined : height}
      viewBox={`0 ${top} ${layout.width} ${height}`}
      role="img"
      aria-label={systemLabel(s)}
      data-system={s.index}
    >
      {!card && (
        <>
          <text className={styles['barNumber']} x={2} y={CHORD_Y}>
            {s.firstBar + 1}
          </text>
          {s.chords.map((c) => {
            const t = chordText(c, chordNames);
            return (
              <text key={c.tick} className={styles['chord']} x={c.x} y={CHORD_Y} data-chord="">
                {t.main}
                {t.sounds && <tspan className={styles['sounding']}>({t.sounds})</tspan>}
              </text>
            );
          })}
        </>
      )}

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

/**
 * A bar card's head: its number, its chords as the reader asked (the chord carried in from the
 * bar before when it doesn't change), and badges for shapes that need a barre or were simplified.
 */
function CardHead({
  system: s,
  arrangement,
  chordNames,
  renderChords,
}: {
  system: SystemLayout;
  arrangement: Arrangement;
  chordNames: ChordNameMode;
  renderChords?: (bar: number, chords: ReactNode) => ReactNode;
}) {
  const marks = arrangement.chordMarks.filter((m) => m.tick >= s.start && m.tick < s.end);
  const carried = marks.length ? [] : arrangement.chordMarks.filter((m) => m.tick < s.start).slice(-1);
  const shown = [...carried, ...marks];
  const capo = arrangement.capo > 0;
  return (
    <div className={styles['cardHead']}>
      <span className={styles['cardBar']} data-bar-number="">
        {s.firstBar + 1}
      </span>
      <span className={styles['cardChords']} data-card-chord="">
        {(() => {
          const chords = shown.map((m, i) => {
            const t = chordText({ name: m.voicing.name, sounding: capo && m.soundingName !== m.voicing.name ? m.soundingName : undefined }, chordNames);
            return (
              <span key={m.tick} className={carried.length ? styles['carried'] : undefined}>
                {i > 0 && ' · '}
                <b>{t.main}</b>
                {t.sounds && <span className={styles['cardSounds']}> sounds {t.sounds}</span>}
              </span>
            );
          });
          return renderChords ? renderChords(s.firstBar, chords) : chords;
        })()}
      </span>
      {marks.some((m) => m.voicing.barre) && <span className={styles['badge']}>Barre</span>}
      {marks.some((m) => m.voicing.simplified) && <span className={styles['badge']}>Simplified</span>}
    </div>
  );
}

/** The tab: chord names, techniques, six strings (high e on top), right-hand fingers and the playhead. */
export function TabSheet({
  arrangement,
  width,
  cursorIndex,
  showFingers = true,
  showTechniques = true,
  reveal = true,
  label = 'Tab',
  onSeek,
  follow = true,
  jumpKey,
  onPlayheadView,
  coveredBottom = 0,
  variant = 'lines',
  sections,
  chordNames = 'both',
  size = 'm',
  renderChords,
  className,
}: TabSheetProps) {
  const cards = variant === 'cards';
  // Card mode: as many columns as fit the tab size; one bar a card, drawn at the card's inner width.
  const cols = cards ? Math.max(1, Math.floor((width + CARD_GAP) / (CARD_TARGET[size] + CARD_GAP))) : 1;
  const inner = cards ? Math.floor((width - CARD_GAP * (cols - 1)) / cols) - 2 * CARD_PAD : width;
  const layout = useMemo(() => layoutSheet(arrangement, inner, cards ? { barsPerSystem: 1 } : {}), [arrangement, inner, cards]);
  const reduced = useReducedMotion();
  const sheetRef = useRef<HTMLDivElement>(null);

  const cursor = cursorIndex === undefined ? undefined : layout.positions[cursorIndex];
  const activeTick = cursor ? arrangement.events[cursorIndex as number].tick : undefined;
  const revealKey = reveal ? `${arrangement.style}:${arrangement.level}:${arrangement.patternId}` : null;

  // Keep the playing system in view; only when it changes, not on every note, and
  // only while following (the reader may have scrolled away on purpose).
  const cursorSystem = cursor?.system;
  const lastSystem = useRef<number | undefined>(undefined);
  const scrollTo = (system: number, block: ScrollLogicalPosition) => {
    const el = sheetRef.current?.querySelector(`[data-system="${system}"]`);
    el?.scrollIntoView?.({ block, behavior: reduced ? 'auto' : 'smooth' });
  };
  useEffect(() => {
    if (cursorSystem === undefined || cursorSystem === lastSystem.current) return;
    const first = lastSystem.current === undefined;
    lastSystem.current = cursorSystem;
    if (first || !follow) return;
    scrollTo(cursorSystem, 'nearest');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scroll on a row change only
  }, [cursorSystem, reduced]);

  // Asked to come back to the playhead: centre the playing row.
  const lastJump = useRef(jumpKey);
  useEffect(() => {
    if (jumpKey === lastJump.current) return;
    lastJump.current = jumpKey;
    if (cursorSystem !== undefined) scrollTo(cursorSystem, 'center');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when asked
  }, [jumpKey]);

  // Tell the caller where the playing row is, so it can offer a way back to it.
  useEffect(() => {
    if (!onPlayheadView || cursorSystem === undefined || typeof IntersectionObserver === 'undefined') return;
    const el = sheetRef.current?.querySelector(`[data-system="${cursorSystem}"]`);
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) onPlayheadView('visible');
        else onPlayheadView(entry.boundingClientRect.top < 0 ? 'above' : 'below');
      },
      // Most of the row must show above whatever covers the bottom of the window.
      { rootMargin: `0px 0px -${Math.round(coveredBottom)}px 0px`, threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [cursorSystem, onPlayheadView, coveredBottom]);

  if (!layout.systems.length) return null;

  const view = (s: SystemLayout) => {
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
        onSeek={onSeek}
        chordNames={chordNames}
        card={cards}
      />
    );
  };

  if (cards) {
    const card = (s: SystemLayout) => (
      <div key={s.index} className={styles['card']} data-bar-card={s.index} data-active={cursor?.system === s.index ? '' : undefined}>
        <CardHead system={s} arrangement={arrangement} chordNames={chordNames} renderChords={renderChords} />
        {view(s)}
      </div>
    );
    const grid = (systems: SystemLayout[]) => (
      <div className={styles['cards']} data-cards="" style={{ ['--cols' as string]: String(cols) }}>
        {systems.map(card)}
      </div>
    );
    return (
      <div
        ref={sheetRef}
        role="region"
        aria-label={label}
        tabIndex={0}
        className={[styles['cardSheet'], className].filter(Boolean).join(' ')}
        data-reduced-motion={reduced ? '' : undefined}
      >
        {sections?.length
          ? sections.map((sec) => {
              const headingId = `${label.replace(/\W+/g, '-')}-${sec.id}`;
              return (
                <div key={sec.id} role="group" aria-labelledby={headingId} className={styles['cardSection']} data-section={sec.id}>
                  <h3 id={headingId} className={styles['sectionTitle']}>
                    {sec.title}
                    {sec.detail && <span className={styles['sectionDetail']}>{sec.detail}</span>}
                  </h3>
                  {grid(layout.systems.slice(sec.firstBar, sec.firstBar + sec.bars))}
                </div>
              );
            })
          : grid(layout.systems)}
      </div>
    );
  }

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
      {layout.systems.map(view)}
    </div>
  );
}
