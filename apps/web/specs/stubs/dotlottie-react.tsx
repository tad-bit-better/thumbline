// Test stand-in for @lottiefiles/dotlottie-react: jsdom can't run the WASM
// renderer, and tests must not fetch it. Renders a canvas and finishes
// one-shots straight away, like a very fast real player.
import { useEffect } from 'react';

type Handler = () => void;

export const setWasmUrl = (_url: string) => undefined;

export function DotLottieReact({
  src,
  loop,
  dotLottieRefCallback,
}: {
  src?: string;
  loop?: boolean;
  dotLottieRefCallback?: (player: unknown) => void;
}) {
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    dotLottieRefCallback?.({
      // A one-shot finishes as soon as someone listens for the end.
      addEventListener: (type: string, fn: Handler) => {
        if (type === 'load') setTimeout(fn, 0);
        if (type === 'complete' && !loop) t = setTimeout(fn, 0);
      },
      removeEventListener: () => undefined,
      play: () => undefined,
      pause: () => undefined,
    });
    return () => {
      clearTimeout(t);
      dotLottieRefCallback?.(null);
    };
  }, [dotLottieRefCallback, loop]);
  return <canvas data-lottie={src} />;
}
