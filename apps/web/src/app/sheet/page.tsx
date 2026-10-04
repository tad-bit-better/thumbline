'use client';

import { type Arrangement, type Level, type Style, arrange, patternsFor } from '@thumbline/engine';
import { ChordShapes, TabLegend, TabSheet } from '@thumbline/tab-renderer';
import {
  Button,
  Card,
  Chip,
  Dialog,
  PlayerBar,
  SegmentedControl,
  StyleCard,
  useReducedMotion,
  useToast,
} from '@thumbline/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { effectiveAnalysis, songStore, useSong } from '../../lib/song-store';
import { useSheetPlayer } from '../../lib/use-sheet-player';
import { useWidth } from '../../lib/use-width';
import styles from './sheet.module.css';

const KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const STYLE_NAMES: Record<Style, string> = { arpeggio: 'Arpeggio', fingerstyle: 'Fingerstyle', flamenco: 'Flamenco' };
const LEVELS = [
  { value: 'basic', label: 'Basic' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'advanced', label: 'Advanced' },
] as const;
const STYLE_CARDS = [
  { kind: 'arpeggio', title: 'Arpeggio', hint: 'Rolling patterns that let every note of the chord ring.' },
  { kind: 'fingerstyle', title: 'Fingerstyle', hint: 'A steady thumb with the fingers playing around it.' },
] as const;
const MIX_TEXT = { sheet: 'sheet only', original: 'original only', both: 'sheet and original' } as const;
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

const isTyping = (el: Element | null) =>
  !!el && (el.matches('input, textarea, select, [contenteditable="true"]') || el.closest('dialog[open], [popover]') !== null);

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

  useEffect(() => {
    if (!hydrated) return;
    if (!meta) routerRef.current.replace('/');
    else if (!analysis) routerRef.current.replace('/listen');
  }, [hydrated, meta, analysis]);

  const effective = useMemo(() => (analysis ? effectiveAnalysis(analysis, edits) : null), [analysis, edits]);
  const patterns = useMemo(
    () => (effective ? patternsFor(prefs.style, prefs.level, effective.meter.beatsPerBar) : []),
    [effective, prefs.style, prefs.level],
  );
  const pattern = patterns.length ? patterns[(prefs.pattern[`${prefs.style}.${prefs.level}`] ?? 0) % patterns.length] : null;
  const arrangement = useMemo<Arrangement | null>(() => {
    if (!effective || !pattern) return null;
    try {
      return arrange(effective, { style: prefs.style, level: prefs.level, patternId: pattern.id });
    } catch {
      return null;
    }
  }, [effective, prefs.style, prefs.level, pattern]);

  const onEnd = useCallback(() => {
    if (!arrangement || loop) return;
    const key = `${meta?.name}:${arrangement.patternId}`;
    if (celebrated.current.has(key)) return;
    celebrated.current.add(key);
    // First full play (moment #8); the confetti dotLottie arrives in M8.
    toast({ message: 'Nice! You played the whole song.', tone: 'success' });
  }, [arrangement, loop, meta?.name, toast]);

  const player = useSheetPlayer({
    arrangement,
    beats: effective ? { beatTimesSec: effective.beatTimesSec, barStartBeat: effective.barStartBeat } : undefined,
    file,
    mix: prefs.mix,
    speed: prefs.speed,
    loop,
    onEnd,
  });

  const currentBar = () => {
    if (!arrangement || player.cursor === undefined) return 0;
    return Math.floor(arrangement.events[player.cursor].tick / (arrangement.meter.beatsPerBar * 480));
  };

  const keys = useRef<(e: KeyboardEvent) => void>(() => undefined);
  keys.current = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || isTyping(document.activeElement)) return;
    const onButton = document.activeElement?.matches('button, [role="radio"], input[type="radio"]');
    if (e.key === ' ' && !onButton) {
      e.preventDefault();
      void player.toggle();
    } else if (e.key === 'l' || e.key === 'L') setLoop((l) => !l);
    else if (e.key === '1' || e.key === '2' || e.key === '3') songStore.getState().setLevel(LEVELS[Number(e.key) - 1].value);
    else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && player.state === 'playing' && arrangement) {
      e.preventDefault();
      const bar = Math.min(arrangement.bars - 1, Math.max(0, currentBar() + (e.key === 'ArrowRight' ? 1 : -1)));
      void player.play(bar);
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
                <span className={styles.eq} aria-hidden="true" data-reduced-motion={reduced ? '' : undefined}>
                  <span />
                  <span />
                  <span />
                </span>
              )}
            </h1>
          </div>
          <div className={styles.chips}>
            <Chip tone="violet">{arrangement && arrangement.capo > 0 ? `Capo on the ${ordinal(arrangement.capo)} fret` : 'No capo needed'}</Chip>
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
              selected={prefs.style === s.kind}
              onSelect={() => songStore.getState().setStyle(s.kind)}
            />
          ))}
          <StyleCard
            kind="flamenco"
            headingLevel={2}
            title="Flamenco"
            hint="Rumba and tangos with rasgueado and golpe."
            sublabel="Coming soon"
            name="style"
            disabled
            onSelect={() => undefined}
          />
        </div>

        <div className={styles.levelRow}>
          <SegmentedControl
            label="Level"
            options={LEVELS}
            value={prefs.level}
            onChange={(v: Level) => songStore.getState().setLevel(v)}
          />
          {pattern && (
            <Card padding="sm" className={styles.pattern}>
              <div>
                <b>{pattern.name}</b>
                <p>{pattern.hint}</p>
              </div>
              {patterns.length > 1 && (
                <Button variant="ghost" onClick={() => songStore.getState().cyclePattern(patterns.length)}>
                  Try another pattern
                </Button>
              )}
            </Card>
          )}
        </div>

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
              <Card padding="md" className={styles.tabCard}>
                <div ref={tabRef}>
                  <TabSheet
                    arrangement={arrangement}
                    width={tabWidth}
                    cursorIndex={player.cursor}
                    label={`${STYLE_NAMES[prefs.style]} tab`}
                  />
                </div>
                <TabLegend arrangement={arrangement} />
              </Card>
            </section>
          </>
        )}

        <div className={styles.player}>
          <PlayerBar
            playing={playing}
            preparing={player.state === 'preparing'}
            onTogglePlay={() => void player.toggle()}
            title={`${STYLE_NAMES[prefs.style]}, ${LEVELS.find((l) => l.value === prefs.level)?.label}`}
            subtitle={`${Math.round(effective.bpm)} bpm, ${MIX_TEXT[file ? prefs.mix : 'sheet']}${prefs.speed < 1 ? `, ${prefs.speed * 100}% speed` : ''}`}
            mix={file ? prefs.mix : 'sheet'}
            mixDisabled={!file}
            onMixChange={(m) => songStore.getState().setMix(m)}
            speed={prefs.speed}
            onSpeedChange={(s) => songStore.getState().setSpeed(s)}
            loop={loop}
            onLoopChange={setLoop}
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
        Your sheet and chord edits for this song will be cleared from this device.
      </Dialog>
    </AppShell>
  );
}
