'use client';

import { AnalysisError, type Progress } from '@thumbline/audio-analysis';
import type { AnalysisResult } from '@thumbline/engine';
import {
  Button,
  CheckGlyph,
  Chip,
  LottieMoment,
  Metronome,
  ProgressBar,
  Stepper,
  usePageVisible,
  useReducedMotion,
} from '@thumbline/ui';
import { useRouter } from 'next/navigation';
import {
  type CSSProperties,
  ViewTransition,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppShell, STEPS } from '../../components/AppShell';
import { LOTTIE, METRONOME_AUTHORED_BPM } from '../../lib/lottie';
import { analyze } from '../../lib/analyze';
import { formatDuration } from '../../lib/format';
import { songStore, useSong } from '../../lib/song-store';
import styles from './listen.module.css';

const WAVE = [
  22, 40, 58, 34, 64, 48, 70, 30, 52, 66, 38, 60, 44, 72, 28, 56, 68, 36, 62,
  46, 58, 32, 50, 70, 40, 54, 26, 44,
];
const WAVE_MS = 1100;
/** Long enough to see the last tick before moving on. */
const ADVANCE_MS = 600;

const STEP_NAMES = [
  'Decoding the audio',
  'Finding the beat',
  'Hearing the chords',
  'Writing your sheets',
] as const;
const STEP_OF: Record<Progress['step'], number> = {
  decode: 0,
  beats: 1,
  key: 1,
  chords: 2,
  done: 3,
};

type Live = {
  step: number;
  fraction: number;
  bpm?: number;
  beatsPerBar?: number;
  bar?: number;
  bars?: number;
  seconds?: number;
};

const asFile = (blob: Blob, name: string, type: string) =>
  blob instanceof File ? blob : new File([blob], name, { type });

export default function Listen() {
  const router = useRouter();
  // The analysis effect must not restart when the router object changes identity.
  const routerRef = useRef(router);
  routerRef.current = router;
  const hydrated = useSong((s) => s.hydrated);
  const meta = useSong((s) => s.meta);
  const file = useSong((s) => s.file);
  const reduced = useReducedMotion();
  const visible = usePageVisible();
  const [live, setLive] = useState<Live>({ step: 0, fraction: 0 });
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    const nav = routerRef.current;
    if (!meta || !file) return nav.replace('/');
    if (songStore.getState().analysis) return nav.replace('/review');

    const abort = new AbortController();
    controller.current = abort;
    let timer: ReturnType<typeof setTimeout> | undefined;
    analyze(
      asFile(file, meta.name, meta.type),
      (p) =>
        setLive((prev) => ({
          ...prev,
          step: STEP_OF[p.step],
          fraction: p.fraction,
          bpm: p.detail?.bpm ?? prev.bpm,
          beatsPerBar: p.detail?.beatsPerBar ?? prev.beatsPerBar,
          bar: p.detail?.bar ?? prev.bar,
          bars: p.detail?.bars ?? prev.bars,
        })),
      abort.signal,
    ).then(
      (result: AnalysisResult) => {
        setLive((prev) => ({
          ...prev,
          step: 3,
          fraction: 1,
          bpm: result.bpm,
          beatsPerBar: result.meter.beatsPerBar,
          seconds: result.durationSec,
        }));
        timer = setTimeout(() => {
          songStore.getState().setAnalysis(result);
          nav.push('/review');
        }, ADVANCE_MS);
      },
      (err: unknown) => {
        if (abort.signal.aborted) return;
        const message =
          err instanceof AnalysisError
            ? err.message
            : 'Something went wrong while listening. Please try again.';
        songStore.getState().setUploadError(message);
        nav.replace('/');
      },
    );
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [hydrated, meta, file]);

  const cancel = () => {
    controller.current?.abort();
    router.push('/');
  };

  const details: Array<string | undefined> = [
    undefined,
    live.bpm
      ? `${Math.round(live.bpm)} bpm${live.beatsPerBar ? `, ${live.beatsPerBar}/4` : ''}`
      : undefined,
    live.bar && live.bars && live.step === 2
      ? `bar ${live.bar} of ${live.bars}`
      : undefined,
    undefined,
  ];
  const valueText = `${STEP_NAMES[Math.min(live.step, 3)]}${details[live.step] ? `, ${details[live.step]}` : ''}`;

  return (
    <AppShell actions={<Stepper steps={STEPS} current={1} align="end" />}>
      <main className={styles.main}>
        <ViewTransition name="main-card">
          <div className={styles.card}>
            <div className={styles.head}>
              {/* Metronome (moment #3): still until the tempo is found, then swings at it. */}
              <LottieMoment
                loop
                src={live.bpm ? LOTTIE.metronome : undefined}
                speed={live.bpm ? live.bpm / METRONOME_AUTHORED_BPM : 1}
                width={120}
                height={120}
                fallback={<Metronome size={120} />}
                label={
                  live.bpm
                    ? `Metronome at ${Math.round(live.bpm)} bpm`
                    : undefined
                }
              />
              <div className={styles.headText}>
                <h1>Listening to your song</h1>
                <p>
                  This takes about 15 seconds. Everything runs on your device.
                </p>
                {meta && (
                  <div className={styles.chip}>
                    <Chip font="mono">{meta.name}</Chip>
                    {live.seconds !== undefined && (
                      <>
                        {' '}
                        <Chip font="mono">{formatDuration(live.seconds)}</Chip>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div
              className={styles.wave}
              aria-hidden="true"
              style={{ '--wave-period': `${WAVE_MS}ms` } as CSSProperties}
              data-paused={visible ? undefined : ''}
              data-reduced-motion={reduced ? '' : undefined}
            >
              {WAVE.map((h, i) => (
                <span
                  key={i}
                  className={styles.bar}
                  style={{
                    height: h,
                    animationDelay: `${(i * 70) % WAVE_MS}ms`,
                  }}
                />
              ))}
            </div>

            <ProgressBar
              label="Analysis progress"
              value={live.fraction}
              valueText={valueText}
            />

            <ul
              className={styles.steps}
              data-reduced-motion={reduced ? '' : undefined}
            >
              {STEP_NAMES.map((name, i) => {
                const state =
                  i < live.step
                    ? 'done'
                    : i === live.step
                      ? 'active'
                      : 'pending';
                return (
                  <li
                    key={name}
                    className={styles.step}
                    data-state={state}
                    style={{ '--i': i } as CSSProperties}
                  >
                    <span
                      className={`${styles.mark} ${styles[state]}`}
                      aria-hidden="true"
                    >
                      {state === 'done' && <CheckGlyph />}
                    </span>
                    <span className={styles.stepName}>{name}</span>
                    {details[i] && (
                      <span className={styles.detail}>{details[i]}</span>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className={styles.footer}>
              <Button variant="secondary" onClick={cancel}>
                Cancel
              </Button>
            </div>
          </div>
        </ViewTransition>
      </main>
    </AppShell>
  );
}
