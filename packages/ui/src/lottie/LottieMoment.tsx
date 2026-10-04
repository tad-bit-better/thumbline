import { type CSSProperties, type ReactNode, Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { usePageVisible, useReducedMotion } from '../motion';
import styles from './LottieMoment.module.css';

// Lazy so the dotLottie runtime (WASM) stays out of the first-load bundle.
const DotLottieReact = lazy(() =>
  import('@lottiefiles/dotlottie-react').then((m) => ({ default: m.DotLottieReact })),
);

type Player = {
  addEventListener: (type: 'complete' | 'loadError', fn: () => void) => void;
  removeEventListener: (type: 'complete' | 'loadError', fn: () => void) => void;
  play: () => void;
  pause: () => void;
};

export type LottieMomentProps = {
  /** `.lottie` file; leave out until the animation exists and the still frame shows. */
  src?: string;
  /** Designed still frame: shown under reduced motion, while loading and on error. */
  fallback: ReactNode;
  /** Accessible description; without it the moment is decorative. */
  label?: string;
  loop?: boolean;
  speed?: number;
  /** Change it to play a one-shot moment again. */
  playKey?: string | number;
  /** One-shots: fires at the end, or straight away when the animation can't play. */
  onComplete?: () => void;
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
  width,
  height,
  className,
}: LottieMomentProps) {
  const reduced = useReducedMotion();
  const visible = usePageVisible();
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  // Stable, so the player doesn't re-register on every render.
  const playerRef = useCallback((instance: unknown) => setPlayer((instance as Player | null) ?? null), []);

  const animate = Boolean(src) && !reduced && failedSrc !== src;

  // Without an animation, a one-shot finishes immediately so flows never wait on it.
  useEffect(() => {
    if (!animate) onCompleteRef.current?.();
  }, [animate, playKey]);

  useEffect(() => {
    if (!player || !src) return;
    const done = () => onCompleteRef.current?.();
    const failed = () => setFailedSrc(src);
    player.addEventListener('complete', done);
    player.addEventListener('loadError', failed);
    return () => {
      player.removeEventListener('complete', done);
      player.removeEventListener('loadError', failed);
    };
  }, [player, src]);

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
      {animate ? (
        <Suspense fallback={fallback}>
          <DotLottieReact
            key={playKey}
            className={styles['player']}
            src={src}
            loop={loop}
            speed={speed}
            autoplay
            dotLottieRefCallback={playerRef}
          />
        </Suspense>
      ) : (
        fallback
      )}
    </span>
  );
}
