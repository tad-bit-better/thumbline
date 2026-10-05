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
import { ChordShapes, TabLegend, TabSheet } from '@thumbline/tab-renderer';
import {
  ArrowDownGlyph,
  ArrowUpGlyph,
  Button,
  Card,
  Chip,
  Dialog,
  LottieMoment,
  PlayerBar,
  SegmentedControl,
  Slider,
  StyleCard,
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
import { effectiveAnalysis, songStore, useSong } from '../../lib/song-store';
import { LOTTIE } from '../../lib/lottie';
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
const STYLE_CARDS = [
  {
    kind: 'arpeggio',
    title: 'Arpeggio',
    hint: 'Rolling patterns that let every note of the chord ring.',
  },
  {
    kind: 'fingerstyle',
    title: 'Fingerstyle',
    hint: 'A steady thumb with the fingers playing around it.',
  },
] as const;
/** The sticky player bar's gap from the bottom of the window (sheet.module.css: --space-4). */
const STICKY_GAP_PX = 16;

/** How long a mood slider rests before the sheet re-arranges (a debounce, not an animation). */
const MOOD_SETTLE_MS = 300;

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

  return (
    <AppShell
      actions={
        <>
          <Link className={styles.navLink} href="/review">
            Edit chords
          </Link>
          <Button variant="ghost" onClick={() => setConfirmNew(true)}>
            New song
          </Button>
        </>
      }
    >
      <main>
        <header className={styles.header}>
          <div>
            <p className={styles.clip}>{meta.name}</p>
            <h1 className={styles.title}>
              Your sheet
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
          <div className={styles.chips}>
            <Chip tone="violet">
              {arrangement && arrangement.capo > 0
                ? `Capo on the ${ordinal(arrangement.capo)} fret`
                : 'No capo needed'}
            </Chip>
            <Chip>
              {KEYS[effective.key.pc]} {effective.key.mode}, {meter}/4
            </Chip>
          </div>
        </header>

        <div role="radiogroup" aria-label="Style" className={styles.styles}>
          {STYLE_CARDS.map((s) => (
            <StyleCard
              key={s.kind}
              {...s}
              headingLevel={2}
              name="style"
              selected={style === s.kind}
              onSelect={() => songStore.getState().setStyle(s.kind)}
            />
          ))}
          <StyleCard
            kind="flamenco"
            headingLevel={2}
            title="Flamenco"
            hint="Rumba and tangos with rasgueado and golpe."
            sublabel={
              flamencoOk
                ? PALOS.find((p) => p.value === prefs.palo)?.label
                : 'Needs 4/4'
            }
            name="style"
            selected={style === 'flamenco'}
            disabled={!flamencoOk}
            onSelect={() => songStore.getState().setStyle('flamenco')}
          />
        </div>

        <div className={styles.levelRow}>
          <SegmentedControl
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

        {analysis && !analysis.melody && file && (
          // Songs read before M9 have chords but no tune: one more listen adds it.
          <Card padding="sm" className={styles.pattern}>
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

        {arrangement && arrangement.warnings.length > 0 && (
          <ul className={styles.notes}>
            {arrangement.warnings.map((w) => (
              <li key={w.message}>{w.message}</li>
            ))}
          </ul>
        )}

        {arrangement && (
          <>
            <section className={styles.section} aria-labelledby="shapes-title">
              <h2 id="shapes-title">Chord shapes</h2>
              <ChordShapes arrangement={arrangement} />
            </section>

            <section className={styles.section} aria-labelledby="tab-title">
              <h2 id="tab-title">Tab</h2>
              <ViewTransition name="chords-card">
                <Card padding="md" className={styles.tabCard}>
                  <div ref={tabRef}>
                    <TabSheet
                      arrangement={arrangement}
                      width={tabWidth}
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
                  <TabLegend arrangement={arrangement} />
                </Card>
              </ViewTransition>
            </section>
          </>
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
