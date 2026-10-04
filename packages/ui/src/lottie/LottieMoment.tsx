import { type CSSProperties, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { usePageVisible, useReducedMotion } from '../motion';
import styles from './LottieMoment.module.css';

type PlayerModule = typeof import('@lottiefiles/dotlottie-react');
let wasmUrl: string | undefined;
let loaded: PlayerModule | undefined;

/**
 * Serve the dotLottie renderer from your own origin. Without this the player
 * fetches it from a public CDN (jsdelivr, then unpkg). Call it at startup.
 */
export function setLottieWasmUrl(url: string) {
  wasmUrl = url;
  loaded?.setWasmUrl(url);
}

const loadPlayer = () =>
  import('@lottiefiles/dotlottie-react').then((m) => {
    loaded = m;
    if (wasmUrl) m.setWasmUrl(wasmUrl);
    return m;
  });

/** Fetch the player and its WASM ahead of time (e.g. while the page is idle), so the first moment starts at once. */
export function preloadLottie() {
  void loadPlayer().then(() => (wasmUrl ? fetch(wasmUrl).catch(() => undefined) : undefined));
}


/** A one-shot that hasn't finished by then completes anyway (slow network, stalled player). */
const ONE_SHOT_TIMEOUT_MS = 2000;

type PlayerEvent = 'load' | 'complete' | 'loadError';
type Player = {
  addEventListener: (type: PlayerEvent, fn: () => void) => void;
  removeEventListener: (type: PlayerEvent, fn: () => void) => void;
  play: () => void;
  pause: () => void;
};

export type LottieMomentProps = {
  /** `.lottie` file; without it (or under reduced motion, or on error) the still frame shows. */
  src?: string;
  /** Designed still frame: shown under reduced motion, while loading and on error. */
  fallback: ReactNode;
  /** Accessible description; without it the moment is decorative. */
  label?: string;
  loop?: boolean;
  speed?: number;
  /** Change it to play a one-shot moment again. */
  playKey?: string | number;
  /**
   * One-shots: fires at the end, straight away when the animation can't play,
   * or after `timeoutMs` if it still hasn't finished. Fires once per play.
   */
  onComplete?: () => void;
  timeoutMs?: number;
  width?: number;
  height?: number;
  className?: string;
};

/** One of the signature dotLottie moments (docs/design/motion.md). */
export function LottieMoment({
  src,
  fallback,
  label,
  loop = false,
  speed = 1,
  playKey = 0,
  onComplete,
  timeoutMs = ONE_SHOT_TIMEOUT_MS,
  width,
  height,
  className,
}: LottieMomentProps) {
  const reduced = useReducedMotion();
  const visible = usePageVisible();
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  // Loaded on demand, so the dotLottie runtime (WASM) stays out of the first-load bundle.
  // Not React.lazy: a Suspense reveal inside a <ViewTransition> cross-fades the still into the canvas.
  const [module, setModule] = useState<PlayerModule | undefined>(loaded);
  // The still frame stays under the canvas until the first frame is drawn.
  const [ready, setReady] = useState(false);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });
  // Once per play: the end, a load error and the timeout can all race.
  const completed = useRef<string | number | null>(null);
  const complete = useCallback(() => {
    if (completed.current === playKey) return;
    completed.current = playKey;
    onCompleteRef.current?.();
  }, [playKey]);

  // Stable, so the player doesn't re-register on every render.
  const playerRef = useCallback((instance: unknown) => setPlayer((instance as Player | null) ?? null), []);

  const animate = Boolean(src) && !reduced && failedSrc !== src;

  useEffect(() => {
    if (!animate || module) return;
    let live = true;
    void loadPlayer().then((m) => live && setModule(m));
    return () => {
      live = false;
    };
  }, [animate, module]);

  useEffect(() => setReady(false), [src, playKey]);

  // Without an animation, a one-shot finishes immediately so flows never wait on it.
  useEffect(() => {
    if (!animate) complete();
  }, [animate, complete]);

  // Flows never wait on a slow one either.
  useEffect(() => {
    if (!animate || loop) return;
    const t = setTimeout(complete, timeoutMs);
    return () => clearTimeout(t);
  }, [animate, loop, complete, timeoutMs]);

  useEffect(() => {
    if (!player || !src) return;
    const done = complete;
    const failed = () => setFailedSrc(src);
    const loadedFrame = () => setReady(true);
    player.addEventListener('load', loadedFrame);
    player.addEventListener('complete', done);
    player.addEventListener('loadError', failed);
    return () => {
      player.removeEventListener('load', loadedFrame);
      player.removeEventListener('complete', done);
      player.removeEventListener('loadError', failed);
    };
  }, [player, src, complete]);

  useEffect(() => {
    if (!player || !loop) return;
    if (visible) player.play();
    else player.pause();
  }, [player, loop, visible]);

  const size: CSSProperties = { width, height };
  return (
    <span
      className={[styles['moment'], className].filter(Boolean).join(' ')}
      style={size}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
    >
      {(!animate || !ready) && fallback}
      {animate && module && (
        <module.DotLottieReact
          key={playKey}
          className={[styles['player'], !ready && styles['loading']].filter(Boolean).join(' ')}
          src={src}
          loop={loop}
          speed={speed}
          autoplay
          dotLottieRefCallback={playerRef}
        />
      )}
    </span>
  );
}
