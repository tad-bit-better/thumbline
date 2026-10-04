'use client';

import { isSupportedFile } from '@thumbline/audio-analysis';
import {
  Button,
  Chip,
  LOOP_MS,
  LottieMoment,
  Pick,
  StyleCard,
  UploadGlyph,
  usePageVisible,
  useReducedMotion,
} from '@thumbline/ui';
import { useRouter } from 'next/navigation';
import {
  type CSSProperties,
  type DragEvent,
  ViewTransition,
  useId,
  useRef,
  useState,
} from 'react';
import { AppShell } from '../components/AppShell';
import { songStore, useSong } from '../lib/song-store';
import styles from './page.module.css';

const ACCEPT = '.mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4,audio/x-m4a';
const MAX_BYTES = 200 * 1024 * 1024;
const SAMPLE_URL = '/samples/sample.m4a';
const UNSUPPORTED =
  'That file isn’t one we can read. Use an MP3, WAV or M4A clip.';

const STYLES = [
  {
    kind: 'arpeggio',
    title: 'Arpeggio',
    hint: 'Rolling p-i-m-a patterns that let every note of the chord ring.',
  },
  {
    kind: 'fingerstyle',
    title: 'Fingerstyle',
    hint: 'Travis picking, pinches and hammer-ons with a steady thumb.',
  },
  {
    kind: 'flamenco',
    title: 'Flamenco',
    hint: 'Rumba and tangos with rasgueado, alzapúa and golpe.',
  },
] as const;

const STEPS = [
  ['Drop a clip', 'Any song you own, straight from your device.'],
  ['We listen', 'Tempo, key and chords, worked out in your browser.'],
  ['You check', 'Tap any chord we weren’t sure about.'],
  ['Play along', 'Your sheet plays with the original, at any speed.'],
] as const;

const LockGlyph = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.4}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

export default function Upload() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const limitsId = useId();
  const [dragging, setDragging] = useState(false);
  const [dropping, setDropping] = useState(0);
  const uploadError = useSong((s) => s.uploadError);
  const reduced = useReducedMotion();
  const visible = usePageVisible();

  const accept = (file: File | undefined) => {
    if (!file) return;
    if (!isSupportedFile(file))
      return songStore.getState().setUploadError(UNSUPPORTED);
    if (file.size > MAX_BYTES)
      return songStore
        .getState()
        .setUploadError(
          'That file is too big. Clips can be up to 6 minutes long.',
        );
    songStore.getState().startSong(file);
    setDropping((n) => n + 1);
  };

  const trySample = async () => {
    const blob = await (await fetch(SAMPLE_URL)).blob();
    accept(
      new File([blob], 'Sample clip (G Em C D).m4a', { type: 'audio/mp4' }),
    );
  };

  const onDrag = (e: DragEvent, over: boolean) => {
    e.preventDefault();
    setDragging(over);
  };

  const timing = {
    '--bob-period': `${LOOP_MS.bob}ms`,
    '--march-period': `${LOOP_MS.march}ms`,
  } as CSSProperties;

  return (
    <AppShell
      actions={
        <>
          <a className={styles.navLink} href="#how">
            How it works
          </a>
          <a className={styles.navLink} href="#styles">
            Styles
          </a>
          <a
            className={styles.navLink}
            href="https://github.com/tad-bit-better/thumbline"
          >
            GitHub
          </a>
        </>
      }
    >
      <main>
        <section className={styles.hero}>
          <div className={styles.intro}>
            <div className={styles.badge}>
              <Chip tone="mint" icon={<LockGlyph />}>
                Your audio never leaves this device
              </Chip>
            </div>
            <h1 className={styles.title}>
              Turn any song into a{' '}
              <span className={styles.accent}>right-hand</span> sheet.
            </h1>
            <p className={styles.lede}>
              Drop in a clip. We hear the chords and write a part for you to
              play: arpeggio, fingerstyle or flamenco, at your level.
            </p>
            <div className={styles.ctas}>
              <Button
                size="lg"
                icon={<UploadGlyph />}
                onClick={() => input.current?.click()}
              >
                Choose a file
              </Button>
              <Button variant="ghost" onClick={trySample}>
                or try a sample clip
              </Button>
            </div>
            <input
              ref={input}
              className={styles.fileInput}
              type="file"
              accept={ACCEPT}
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                accept(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>

          <ViewTransition name="main-card">
            <div className={styles.card}>
              <button
                type="button"
                className={styles.zone}
                style={timing}
                aria-label="Drop an audio clip here, or choose a file"
                aria-describedby={limitsId}
                data-dragging={dragging ? '' : undefined}
                data-paused={visible ? undefined : ''}
                data-reduced-motion={reduced ? '' : undefined}
                onClick={() => input.current?.click()}
                onDragEnter={(e) => onDrag(e, true)}
                onDragOver={(e) => onDrag(e, true)}
                onDragLeave={(e) => onDrag(e, false)}
                onDrop={(e) => {
                  onDrag(e, false);
                  accept(e.dataTransfer.files[0]);
                }}
              >
                <svg className={styles.ring} aria-hidden="true">
                  <rect x="1.5" y="1.5" width="99%" height="99%" rx="24" />
                </svg>
                <span className={styles.stage} aria-hidden="true">
                  <span className={styles.pick}>
                    {dropping > 0 ? (
                      // Pick drop (moment #1); the dotLottie file arrives in M8.
                      <LottieMoment
                        playKey={dropping}
                        fallback={<Pick size={150} />}
                        onComplete={() => router.push('/listen')}
                      />
                    ) : (
                      <Pick size={150} />
                    )}
                  </span>
                </span>
                <span className={styles.zoneTitle}>
                  Drop an audio clip here
                </span>
                <span id={limitsId} className={styles.limits}>
                  MP3, WAV or M4A, up to 6 minutes
                </span>
              </button>
              {uploadError && (
                <div className={styles.error}>
                  <p role="alert">{uploadError}</p>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      songStore.getState().setUploadError(null);
                      input.current?.click();
                    }}
                  >
                    Try another file
                  </Button>
                </div>
              )}
            </div>
          </ViewTransition>
        </section>

        <section id="styles" className={styles.section}>
          <h2>Three ways to play it</h2>
          <p className={styles.sectionLede}>
            Every style comes in Basic, Moderate and Advanced.
          </p>
          <div className={styles.styles}>
            {STYLES.map((s) => (
              <StyleCard key={s.kind} {...s} />
            ))}
          </div>
        </section>

        <section id="how" className={styles.section}>
          <h2>How it works</h2>
          <ol className={styles.steps}>
            {STEPS.map(([title, text], i) => (
              <li key={title} className={styles.step}>
                <span className={styles.stepNumber} aria-hidden="true">
                  {i + 1}
                </span>
                <div>
                  <b>{title}</b>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className={styles.footer}>
        <span>Open source under AGPL-3.0</span>
        <span>
          Made for guitarists who never know what the right hand should do
        </span>
      </footer>
    </AppShell>
  );
}
