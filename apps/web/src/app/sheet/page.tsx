'use client';

import {
  type Arrangement,
  type Level,
  type Mood,
  type Style,
  arrange,
  moodLabelOf,
  patternsFor,
} from '@thumbline/engine';
import { ChordShapes, NowNext, TabLegend, TabSheet } from '@thumbline/tab-renderer';
import {
  ArrowDownGlyph,
  ArrowUpGlyph,
  Button,
  Card,
  Checkbox,
  Dialog,
  ChevronLeftGlyph,
  ChevronRightGlyph,
  Drawer,
  IconButton,
  LottieMoment,
  PlayerBar,
  SectionNav,
  SegmentedControl,
  Slider,
  useReducedMotion,
  useToast,
} from '@thumbline/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ViewTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppShell } from '../../components/AppShell';
import {
  MOOD_OPTIONS,
  colourWords,
  detectedMood,
  effectiveMood,
  energyWords,
  moodName,
  presetValues,
} from '../../lib/mood';
import { DEFAULT_DISPLAY, effectiveAnalysis, songStore, useSong } from '../../lib/song-store';
import { LOTTIE } from '../../lib/lottie';
import { sheetSections, songTitle, warningSummary } from '../../lib/sheet-view';
import { useFollowPlayhead } from '../../lib/use-follow-playhead';
import { useSheetPlayer } from '../../lib/use-sheet-player';
import { useWidth } from '../../lib/use-width';
import styles from './sheet.module.css';

const KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const STYLE_NAMES: Record<Style, string> = {
  arpeggio: 'Arpeggio',
  fingerstyle: 'Fingerstyle',
  flamenco: 'Flamenco',
};
const LEVELS = [
  { value: 'basic', label: 'Basic' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'advanced', label: 'Advanced' },
] as const;
const STYLE_OPTIONS = [
  { value: 'arpeggio', label: 'Arpeggio' },
  { value: 'fingerstyle', label: 'Fingerstyle' },
  { value: 'flamenco', label: 'Flamenco' },
] as const;
const STYLE_HINTS: Record<Style, string> = {
  arpeggio: 'Rolling patterns that let every note of the chord ring.',
  fingerstyle: 'A steady thumb with the fingers playing around it.',
  flamenco: 'Rumba and tangos with rasgueado and golpe.',
};
/** The sticky player bar's gap from the bottom of the window (sheet.module.css: --space-4). */
const STICKY_GAP_PX = 16;

/** How long a mood slider rests before the sheet re-arranges (a debounce, not an animation). */
const MOOD_SETTLE_MS = 300;

const CHORD_NAME_OPTIONS = [
  { value: 'shape', label: 'Shape' },
  { value: 'sounding', label: 'Sound' },
  { value: 'both', label: 'Both' },
] as const;
const TAB_SIZES = [
  { value: 's', label: 'S' },
  { value: 'm', label: 'M' },
  { value: 'l', label: 'L' },
] as const;

const PALOS = [
  { value: 'rumba', label: 'Rumba' },
  { value: 'tangos', label: 'Tangos' },
] as const;
const MIX_TEXT = {
  sheet: 'sheet only',
  original: 'original only',
  both: 'sheet and original',
} as const;
const ordinal = (n: number) =>
  `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

const isTyping = (el: Element | null) =>
  !!el &&
  (el.matches('input, textarea, select, [contenteditable="true"]') ||
    el.closest('dialog[open], [popover]') !== null);

export default function SheetPage() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const toast = useToast();
  const reduced = useReducedMotion();
  const hydrated = useSong((s) => s.hydrated);
  const meta = useSong((s) => s.meta);
  const file = useSong((s) => s.file);
  const analysis = useSong((s) => s.analysis);
  const edits = useSong((s) => s.edits);
  const prefs = useSong((s) => s.prefs);
  const [loop, setLoop] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [tabRef, tabWidth] = useWidth<HTMLDivElement>();
  const celebrated = useRef(new Set<string>());
  /** Plays the first-full-play burst once per sheet; bumps to replay. */
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    if (!hydrated) return;
    if (!meta) routerRef.current.replace('/');
    else if (!analysis) routerRef.current.replace('/listen');
  }, [hydrated, meta, analysis]);

  const effective = useMemo(
    () => (analysis ? effectiveAnalysis(analysis, edits) : null),
    [analysis, edits],
  );
  // Rumba and tangos are in 4/4: a song in 3/4 plays arpeggio instead.
  const flamencoOk = effective?.meter.beatsPerBar === 4;
  const style: Style =
    prefs.style === 'flamenco' && !flamencoOk ? 'arpeggio' : prefs.style;
  const palo = style === 'flamenco' ? prefs.palo : undefined;
  // The mood orders the patterns (the default is one that suits it) and sets the touch (M10).
  const moodValues = analysis ? effectiveMood(analysis, edits) : undefined;
  // Slider drags update this at once; the sheet re-arranges once the hand rests (MOOD_SETTLE_MS).
  const [moodDraft, setMoodDraft] = useState<Mood | null>(null);
  const moodTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(moodTimer.current), []);
  const shownMood = moodDraft ?? moodValues;
  const nudgeMood = (next: Mood) => {
    setMoodDraft(next);
    clearTimeout(moodTimer.current);
    moodTimer.current = setTimeout(() => {
      songStore.getState().setMood(next);
      setMoodDraft(null);
    }, MOOD_SETTLE_MS);
  };
  const heardMood = analysis ? detectedMood(analysis) : undefined;
  const mood = moodValues ? moodLabelOf(moodValues) : undefined;
  const patterns = useMemo(
    () =>
      effective
        ? patternsFor(style, prefs.level, effective.meter.beatsPerBar, palo, mood)
        : [],
    [effective, style, prefs.level, palo, mood],
  );
  const pattern = patterns.length
    ? patterns[
        (prefs.pattern[`${style}.${prefs.level}`] ?? 0) % patterns.length
      ]
    : null;
  const arrangement = useMemo<Arrangement | null>(() => {
    if (!effective || !pattern) return null;
    try {
      return arrange(effective, {
        style,
        level: prefs.level,
        patternId: pattern.id,
        palo,
        mood: moodValues,
      });
    } catch {
      return null;
    }
  }, [effective, style, prefs.level, pattern, palo, moodValues]);

  const onEnd = useCallback(
    (wholeSong: boolean) => {
      if (!arrangement || loop || !wholeSong) return;
      const key = `${meta?.name}:${arrangement.patternId}`;
      if (celebrated.current.has(key)) return;
      celebrated.current.add(key);
      // First full play (moment #8): the burst, and the words for everyone.
      setBurst((n) => n + 1);
      toast({ message: 'Nice! You played the whole song.', tone: 'success' });
    },
    [arrangement, loop, meta?.name, toast],
  );

  const player = useSheetPlayer({
    arrangement,
    beats: effective
      ? {
          beatTimesSec: effective.beatTimesSec,
          barStartBeat: effective.barStartBeat,
        }
      : undefined,
    file,
    mix: prefs.mix,
    speed: prefs.speed,
    loop,
    onEnd,
  });

  const sections = useMemo(() => (arrangement ? sheetSections(arrangement) : []), [arrangement]);
  const barTicks = (arrangement?.meter.beatsPerBar ?? 4) * 480;
  const currentBar = Math.floor(player.position / barTicks);
  const follow = useFollowPlayhead();
  // The sticky player bar covers the bottom of the window (not on phones, where it isn't sticky).
  const playerRef = useRef<HTMLDivElement>(null);
  const [playerHeight, setPlayerHeight] = useState(0);
  useEffect(() => {
    const el = playerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => setPlayerHeight(getComputedStyle(el).position === 'sticky' ? el.getBoundingClientRect().height + STICKY_GAP_PX : 0);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [effective]);
  // Seeking means "take me there": the sheet follows again.
  const seekBar = (bar: number) => {
    follow.resume();
    void player.seek(
      Math.min((arrangement?.bars ?? 1) - 1, Math.max(0, bar)) * barTicks,
    );
  };

  const keys = useRef<(e: KeyboardEvent) => void>(() => undefined);
  keys.current = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || isTyping(document.activeElement))
      return;
    const onButton = document.activeElement?.matches(
      'button, [role="radio"], input[type="radio"]',
    );
    if (e.key === ' ' && !onButton) {
      e.preventDefault();
      if (player.state !== 'playing') follow.resume();
      void player.toggle();
    } else if (e.key === 'l' || e.key === 'L') setLoop((l) => !l);
    else if (e.key === '1' || e.key === '2' || e.key === '3')
      songStore.getState().setLevel(LEVELS[Number(e.key) - 1].value);
    else if (
      (e.key === 'ArrowRight' || e.key === 'ArrowLeft') &&
      arrangement &&
      !document.activeElement?.matches('input[type="range"]')
    ) {
      // A bar back or forward, playing or paused (the slider handles its own arrows).
      e.preventDefault();
      seekBar(currentBar + (e.key === 'ArrowRight' ? 1 : -1));
    }
  };
  useEffect(() => {
    const on = (e: KeyboardEvent) => keys.current(e);
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  if (!effective || !meta) return null;
  const meter = effective.meter.beatsPerBar;
  const playing = player.state === 'playing';

  const title = songTitle(meta.name);
  const shapeKey = arrangement && arrangement.capo > 0 ? KEYS[(effective.key.pc - arrangement.capo + 12) % 12] : null;
  const summary = arrangement ? warningSummary(arrangement.warnings) : undefined;
  const currentSection = sections.find((sec) => currentBar >= sec.firstBar && currentBar < sec.firstBar + sec.bars);
  const patternIndex = pattern ? patterns.indexOf(pattern) : -1;
  const arrangementLine = [
    STYLE_NAMES[style] + (palo ? ` (${PALOS.find((p) => p.value === palo)?.label})` : ''),
    LEVELS.find((l) => l.value === prefs.level)?.label,
    mood ? moodName(mood) : undefined,
    pattern?.name,
  ]
    .filter(Boolean)
    .join(' · ');
  // Songs saved before the display options existed have none: the defaults.
  const display = { ...DEFAULT_DISPLAY, ...prefs.display };
  const sectionItems = sections.map((sec) => ({ id: sec.id, title: sec.title, detail: sec.detail }));
  const goToSection = (id: string) => {
    const sec = sections.find((x) => x.id === id);
    if (sec) seekBar(sec.firstBar);
  };

  return (
    <AppShell
      wide
      actions={
        <Button variant="ghost" onClick={() => setConfirmNew(true)}>
          New song
        </Button>
      }
    >
      <main className={styles.page}>
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
                {KEYS[effective.key.pc]} {effective.key.mode}
                {shapeKey && <span className={styles.factNote}>shapes in {shapeKey}</span>}
              </dd>
            </div>
            <div className={styles.fact}>
              <dt>Capo</dt>
              <dd>{arrangement && arrangement.capo > 0 ? `${ordinal(arrangement.capo)} fret` : 'None'}</dd>
            </div>
            <div className={styles.fact}>
              <dt>Time</dt>
              <dd>{meter}/4</dd>
            </div>
            <div className={styles.fact}>
              <dt>Original tempo</dt>
              <dd>{Math.round(effective.bpm)} bpm</dd>
            </div>
          </dl>
          <Link className={styles.navLink} href="/review">
            Edit chords
          </Link>
        </header>

        <Card padding="sm" className={styles.arrangementBar}>
          <div className={styles.arrangementText}>
            <p className={styles.eyebrow}>Arrangement</p>
            <b>{arrangementLine}</b>
          </div>
          <div className={styles.arrangementActions}>
            {patterns.length > 1 && (
              <div className={styles.patternStep}>
                <IconButton
                  label="Previous pattern"
                  icon={<ChevronLeftGlyph />}
                  variant="ghost"
                  onClick={() => songStore.getState().cyclePattern(patterns.length, -1)}
                />
                <span aria-live="polite">
                  Pattern {patternIndex + 1} of {patterns.length}
                </span>
                <IconButton
                  label="Next pattern"
                  icon={<ChevronRightGlyph />}
                  variant="ghost"
                  onClick={() => songStore.getState().cyclePattern(patterns.length)}
                />
              </div>
            )}
            <Button onClick={() => setCustomizing(true)}>Customize</Button>
          </div>
        </Card>

        {analysis && !analysis.melody && file && (
          // Songs read before M9 have chords but no tune: one more listen adds it.
          <Card padding="sm" className={styles.notice}>
            <div>
              <b>Add the tune</b>
              <p>
                This song was read before Thumbline could follow the melody.
                Listen again to put the tune on top. Your chord changes will be
                cleared.
              </p>
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                player.stop();
                songStore.getState().relisten();
                router.push('/listen');
              }}
            >
              Listen again
            </Button>
          </Card>
        )}

        {summary && (
          <p className={styles.warnings}>
            {summary}{' '}
            <Link className={styles.inlineLink} href="/review">
              Review chords
            </Link>
          </p>
        )}

        {arrangement && (
          <div className={styles.layout}>
            <aside className={styles.left} aria-label="Sections and display">
              <Card padding="sm" className={styles.panel}>
                <h2 className={styles.panelTitle}>Sections</h2>
                <SectionNav label="Sections" items={sectionItems} current={currentSection?.id} onSelect={goToSection} />
              </Card>
              <Card padding="sm" className={styles.panel}>
                <h2 className={styles.panelTitle}>Display</h2>
                <p className={styles.optionLabel}>Chord names</p>
                <SegmentedControl
                  label="Chord names"
                  fullWidth
                  tone="secondary"
                  options={CHORD_NAME_OPTIONS}
                  value={display.chordNames}
                  onChange={(chordNames) => songStore.getState().setDisplay({ chordNames })}
                />
                <p className={styles.optionLabel}>Tab size</p>
                <SegmentedControl
                  label="Tab size"
                  fullWidth
                  tone="secondary"
                  options={TAB_SIZES}
                  value={display.tabSize}
                  onChange={(tabSize) => songStore.getState().setDisplay({ tabSize })}
                />
                <Checkbox
                  label="Fingering letters"
                  checked={display.fingers}
                  onChange={(fingers) => songStore.getState().setDisplay({ fingers })}
                />
                <Checkbox
                  label="Legend"
                  checked={display.legend}
                  onChange={(legend) => songStore.getState().setDisplay({ legend })}
                />
              </Card>
            </aside>

            <SectionNav
              className={styles.sectionChips}
              label="Jump to section"
              variant="chips"
              items={sectionItems.map((x) => ({ ...x, title: x.title.replace('Section ', '') }))}
              current={currentSection?.id}
              onSelect={goToSection}
            />

            {/* Focusable: on desktop the rail scrolls on its own, and keyboard users must be able to scroll it. */}
            <aside className={styles.right} aria-label="Chords" tabIndex={0}>
              <Card padding="sm" className={styles.panel}>
                <h2 className={styles.panelTitle}>Now and next</h2>
                <NowNext arrangement={arrangement} tick={player.position} />
              </Card>
              <Card padding="sm" className={[styles.panel, styles.shapesPanel].join(' ')}>
                <h2 className={styles.panelTitle}>Chord shapes</h2>
                <ChordShapes arrangement={arrangement} variant="list" />
              </Card>
            </aside>

            <section className={styles.center} aria-labelledby="tab-title">
              <h2 id="tab-title" className={styles.srOnly}>
                Tab
              </h2>
              {display.legend && <TabLegend arrangement={arrangement} />}
              <ViewTransition name="chords-card">
                <div ref={tabRef} className={styles.tab}>
                  <TabSheet
                    arrangement={arrangement}
                    width={tabWidth}
                    variant="cards"
                    sections={sections}
                    size={display.tabSize}
                    chordNames={display.chordNames}
                    showFingers={display.fingers}
                    cursorIndex={player.cursor}
                    label={`${STYLE_NAMES[style]} tab`}
                    onSeek={(tick) => {
                      follow.resume();
                      void player.seek(tick, true);
                    }}
                    follow={follow.following}
                    jumpKey={follow.jumpKey}
                    onPlayheadView={follow.onPlayheadView}
                    coveredBottom={playerHeight}
                  />
                </div>
              </ViewTransition>
            </section>
          </div>
        )}

        <div className={styles.player} ref={playerRef}>
          {arrangement &&
            !follow.following &&
            follow.where !== 'visible' &&
            (playing || player.position > 0) && (
              // The reader scrolled away: one tap (or F) brings the playhead back into view.
              <div className={styles.follow}>
                <Button
                  variant="secondary"
                  icon={
                    follow.where === 'above' ? (
                      <ArrowUpGlyph />
                    ) : (
                      <ArrowDownGlyph />
                    )
                  }
                  onClick={follow.back}
                  aria-keyshortcuts="F"
                >
                  Back to the playhead
                </Button>
              </div>
            )}
          {burst > 0 && (
            <LottieMoment
              src={LOTTIE.firstPlay}
              playKey={burst}
              width={480}
              height={320}
              className={styles.burst}
              fallback={null}
              onComplete={() => setBurst(0)}
            />
          )}
          <PlayerBar
            playing={playing}
            preparing={player.state === 'preparing'}
            onTogglePlay={() => {
              if (!playing) follow.resume();
              void player.toggle();
            }}
            title={`${STYLE_NAMES[style]}${palo ? ` (${PALOS.find((p) => p.value === palo)?.label})` : ''}, ${LEVELS.find((l) => l.value === prefs.level)?.label}`}
            subtitle={`${Math.round(effective.bpm)} bpm, ${MIX_TEXT[file ? prefs.mix : 'sheet']}${prefs.speed < 1 ? `, ${prefs.speed * 100}% speed` : ''}`}
            mix={file ? prefs.mix : 'sheet'}
            mixDisabled={!file}
            onMixChange={(m) => songStore.getState().setMix(m)}
            speed={prefs.speed}
            onSpeedChange={(s) => songStore.getState().setSpeed(s)}
            loop={loop}
            onLoopChange={setLoop}
            position={
              arrangement
                ? { bar: currentBar, bars: arrangement.bars }
                : undefined
            }
            onSeek={seekBar}
          />
        </div>
      </main>

      <Drawer open={customizing} title="Customize" onClose={() => setCustomizing(false)}>
        <div className={styles.customize}>
          <h3 className={styles.panelTitle}>Style</h3>
          <SegmentedControl
            label="Style"
            fullWidth
            options={STYLE_OPTIONS.map((o) => (o.value === 'flamenco' && !flamencoOk ? { ...o, disabled: true } : o))}
            value={style}
            onChange={(v: Style) => songStore.getState().setStyle(v)}
          />
          <p className={styles.hint}>
            {STYLE_HINTS[style]}
            {!flamencoOk && ' Flamenco needs a song in 4/4.'}
          </p>

          <div className={styles.levelRow}>
            <h3 className={styles.panelTitle}>Level</h3>
            <SegmentedControl
              fullWidth
              label="Level"
              options={LEVELS}
              value={prefs.level}
              onChange={(v: Level) => songStore.getState().setLevel(v)}
            />
            {style === 'flamenco' && (
              // DESIGN-REVIEW: screens.md shows the palo only as the card's sub-label; this is how you pick it.
              <SegmentedControl
                label="Palo"
                options={PALOS}
                value={prefs.palo}
                onChange={(v) => songStore.getState().setPalo(v)}
              />
            )}
            {shownMood && (
              <Card padding="sm" className={styles.feel}>
                <SegmentedControl
                  label="Mood"
                  tone="secondary"
                  fullWidth
                  options={MOOD_OPTIONS}
                  value={moodLabelOf(shownMood)}
                  onChange={(v) => nudgeMood(presetValues(v))}
                />
                <Slider
                  label="Energy"
                  minLabel="Calm"
                  maxLabel="Driving"
                  value={shownMood.energy}
                  valueText={(v) => `${Math.round(v * 100)}%, ${energyWords(v)}`}
                  onChange={(energy) => nudgeMood({ ...shownMood, energy })}
                />
                <Slider
                  label="Colour"
                  minLabel="Dark"
                  maxLabel="Bright"
                  value={shownMood.valence}
                  valueText={(v) => `${Math.round(v * 100)}%, ${colourWords(v)}`}
                  onChange={(valence) => nudgeMood({ ...shownMood, valence })}
                />
                {heardMood && edits.mood && (
                  <p className={styles.feelNote}>
                    It sounded {moodName(heardMood).toLowerCase()} to us.{' '}
                    <Button
                      variant="ghost"
                      onClick={() => {
                        clearTimeout(moodTimer.current);
                        setMoodDraft(null);
                        songStore.getState().resetMood();
                      }}
                    >
                      Use what we heard
                    </Button>
                  </p>
                )}
              </Card>
            )}
            {pattern && (
              <Card padding="sm" className={styles.pattern}>
                <div>
                  <b>{pattern.name}</b>
                  <p>{pattern.hint}</p>
                </div>
                {patterns.length > 1 && (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      songStore.getState().cyclePattern(patterns.length)
                    }
                  >
                    Try another pattern
                  </Button>
                )}
              </Card>
            )}
          </div>
        </div>
      </Drawer>

      <Dialog
        open={confirmNew}
        title="Start a new song?"
        onClose={() => setConfirmNew(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirmNew(false)}>
              Keep this one
            </Button>
            <Button
              onClick={() => {
                player.stop();
                songStore.getState().clear();
                router.push('/');
              }}
            >
              Start over
            </Button>
          </>
        }
      >
        Your sheet and chord edits for this song will be cleared from this
        device.
      </Dialog>
    </AppShell>
  );
}
