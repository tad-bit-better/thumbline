'use client';

import {
  ArrowDownGlyph,
  ArrowUpGlyph,
  Button,
  Dialog,
  LottieMoment,
  PlayerBar,
  useReducedMotion,
  useToast,
} from '@thumbline/ui';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { LOTTIE } from '../../lib/lottie';
import { detectedMood, moodName } from '../../lib/mood';
import { songTitle, warningSummary } from '../../lib/sheet-view';
import { DEFAULT_DISPLAY, songStore, useSong } from '../../lib/song-store';
import { useFollowPlayhead } from '../../lib/use-follow-playhead';
import { useSheetPlayer } from '../../lib/use-sheet-player';
import { useWidth } from '../../lib/use-width';
import { ArrangementBar } from './ArrangementBar';
import { CustomizePanel } from './CustomizePanel';
import { SheetHeader } from './SheetHeader';
import { SheetNotices } from './SheetNotices';
import { SheetTab } from './SheetTab';
import { LEVELS, MIX_TEXT, levelLabel, styleLabel } from './sheet-labels';
import styles from './sheet.module.css';
import { useChordChecking } from './use-chord-checking';
import { useSheetArrangement } from './use-sheet-arrangement';
import { useSheetKeys } from './use-sheet-keys';

/** The sticky player bar's gap from the bottom of the window (sheet.module.css: --space-4). */
const STICKY_GAP_PX = 16;

/** The Sheet screen (screens.md §4): the tab as bar cards, with chords and sections to edit, and the player. */
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

  const {
    effective,
    flamencoOk,
    style,
    palo,
    moodValues,
    mood,
    patterns,
    pattern,
    sections,
    arrangement,
    betterCapo,
  } = useSheetArrangement(analysis, edits, prefs);
  const chords = useChordChecking(effective, edits.confirmed, file, reduced);

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
    tuningCents: effective?.tuningCents,
    file,
    mix: prefs.mix,
    originalLevel: prefs.originalLevel,
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
    const measure = () =>
      setPlayerHeight(
        getComputedStyle(el).position === 'sticky'
          ? el.getBoundingClientRect().height + STICKY_GAP_PX
          : 0,
      );
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
  const togglePlay = () => {
    if (player.state !== 'playing') follow.resume();
    void player.toggle();
  };

  useSheetKeys({
    togglePlay,
    toggleLoop: () => setLoop((l) => !l),
    setLevel: (i) => songStore.getState().setLevel(LEVELS[i].value),
    step: arrangement ? (d) => seekBar(currentBar + d) : undefined,
  });

  if (!effective || !meta) return null;
  const playing = player.state === 'playing';
  const summary = arrangement
    ? warningSummary(arrangement.warnings)
    : undefined;
  const arrangementLine = [
    styleLabel(style, palo),
    levelLabel(prefs.level),
    mood ? moodName(mood) : undefined,
    pattern?.name,
  ]
    .filter(Boolean)
    .join(' · ');
  // Songs saved before the display options existed have none: the defaults.
  const display = { ...DEFAULT_DISPLAY, ...prefs.display };
  const toCheck = chords.flaggedBars.length;
  const stopAudio = () => {
    player.stop();
    chords.barPlayer.stop();
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
        <SheetHeader
          title={songTitle(meta.name)}
          song={effective}
          arrangement={arrangement}
          playing={playing}
          reduced={reduced}
        />

        <ArrangementBar
          line={arrangementLine}
          patternIndex={pattern ? patterns.indexOf(pattern) : -1}
          patternCount={patterns.length}
          display={display}
          onCustomize={() => setCustomizing(true)}
        />

        <SheetNotices
          addTune={!!analysis && !analysis.melody && !!file}
          onListenAgain={() => {
            player.stop();
            songStore.getState().relisten();
            router.push('/listen');
          }}
          toCheck={toCheck}
          onCheck={() => chords.openChord(chords.flaggedBars[0])}
          summary={summary}
          betterCapo={betterCapo}
        />

        {arrangement && analysis && (
          <SheetTab
            arrangement={arrangement}
            analysis={analysis}
            file={file}
            style={style}
            sections={sections}
            patterns={patterns}
            songFullness={prefs.fullness}
            edits={edits}
            display={display}
            player={player}
            follow={follow}
            chords={chords}
            tabRef={tabRef}
            tabWidth={tabWidth}
            playerHeight={playerHeight}
          />
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
            onTogglePlay={togglePlay}
            title={`${styleLabel(style, palo)}, ${levelLabel(prefs.level)}`}
            subtitle={`${Math.round(effective.bpm)} bpm, ${MIX_TEXT[file ? prefs.mix : 'sheet']}${prefs.speed < 1 ? `, ${prefs.speed * 100}% speed` : ''}`}
            mix={file ? prefs.mix : 'sheet'}
            mixDisabled={!file}
            onMixChange={(m) => songStore.getState().setMix(m)}
            originalLevel={prefs.originalLevel}
            onOriginalLevelChange={(v) =>
              songStore.getState().setOriginalLevel(v)
            }
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

      <CustomizePanel
        open={customizing}
        onClose={() => setCustomizing(false)}
        stopAudio={stopAudio}
        bpm={effective.bpm}
        beatsPerBar={effective.meter.beatsPerBar}
        style={style}
        flamencoOk={flamencoOk}
        prefs={prefs}
        edits={edits}
        mood={moodValues}
        heardMood={analysis ? detectedMood(analysis) : undefined}
        pattern={pattern}
        patternCount={patterns.length}
      />

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
