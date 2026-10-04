import { act, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { ReducedMotionProvider } from '../motion';
import { axeViolations } from '../testing/axe';
import { LottieMoment, setLottieWasmUrl } from './LottieMoment';

const player = vi.hoisted(() => {
  const handlers = new Map<string, () => void>();
  const play = vi.fn();
  const pause = vi.fn();
  const setWasmUrl = vi.fn();
  return {
    setWasmUrl,
    props: null as Record<string, unknown> | null,
    handlers,
    play,
    pause,
    instance: {
      addEventListener: (type: string, fn: () => void) => handlers.set(type, fn),
      removeEventListener: (type: string) => handlers.delete(type),
      play,
      pause,
    },
  };
});

vi.mock('@lottiefiles/dotlottie-react', () => ({
  setWasmUrl: player.setWasmUrl,
  DotLottieReact: (props: Record<string, unknown> & { dotLottieRefCallback?: (i: unknown) => void }) => {
    player.props = props;
    const register = props.dotLottieRefCallback;
    // Like the real player: hand over one instance once it exists.
    useEffect(() => {
      register?.(player.instance);
      return () => register?.(null);
    }, [register]);
    return <canvas data-testid="player" />;
  },
}));

const still = <span data-testid="still">still</span>;
const fire = (type: string) => act(() => player.handlers.get(type)?.());

beforeEach(() => {
  player.props = null;
  player.handlers.clear();
  player.play.mockClear();
  player.pause.mockClear();
});

describe('LottieMoment', () => {
  it('shows the still frame and completes at once when there is no file yet', () => {
    const onComplete = vi.fn();
    render(<LottieMoment fallback={still} onComplete={onComplete} />);
    expect(screen.getByTestId('still')).toBeTruthy();
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('never loads the player under reduced motion', () => {
    const onComplete = vi.fn();
    render(
      <ReducedMotionProvider reduced>
        <LottieMoment src="/lottie/pick-drop.lottie" fallback={still} onComplete={onComplete} />
      </ReducedMotionProvider>,
    );
    expect(screen.getByTestId('still')).toBeTruthy();
    expect(player.props).toBeNull();
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('lazy-loads the player with the right options', async () => {
    render(<LottieMoment src="/lottie/listening.lottie" fallback={still} loop speed={1.5} />);
    expect(await screen.findByTestId('player')).toBeTruthy();
    expect(player.props).toMatchObject({ src: '/lottie/listening.lottie', loop: true, speed: 1.5, autoplay: true });
  });

  it('reports completion of a one-shot moment', async () => {
    const onComplete = vi.fn();
    render(<LottieMoment src="/lottie/pick-drop.lottie" fallback={still} onComplete={onComplete} />);
    await screen.findByTestId('player');
    expect(onComplete).not.toHaveBeenCalled();
    fire('complete');
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('falls back to the still frame when the file fails to load', async () => {
    const onComplete = vi.fn();
    render(<LottieMoment src="/missing.lottie" fallback={still} onComplete={onComplete} />);
    await screen.findByTestId('player');
    fire('loadError');
    expect(screen.getByTestId('still')).toBeTruthy();
    expect(screen.queryByTestId('player')).toBeNull();
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('pauses a loop while the tab is hidden', async () => {
    render(<LottieMoment src="/lottie/listening.lottie" fallback={still} loop />);
    await screen.findByTestId('player');
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(player.pause).toHaveBeenCalled();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(player.play).toHaveBeenCalled();
  });

  it('is decorative unless labelled', () => {
    const { container, rerender } = render(<LottieMoment fallback={still} />);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
    rerender(<LottieMoment fallback={still} label="Metronome at 92 bpm" />);
    expect(screen.getByRole('img', { name: 'Metronome at 92 bpm' })).toBeTruthy();
  });

  it('has no axe violations', async () => {
    const { container } = render(<LottieMoment fallback={still} label="Listening" />);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('loads the renderer from our own origin when told to', async () => {
    setLottieWasmUrl('/lottie/dotlottie-player-test.wasm');
    render(<LottieMoment src="/lottie/listening.lottie" fallback={still} loop />);
    await screen.findByTestId('player');
    expect(player.setWasmUrl).toHaveBeenCalledWith('/lottie/dotlottie-player-test.wasm');
  });

  it('completes a slow one-shot after the timeout, and only once', async () => {
    vi.useFakeTimers();
    try {
      const onComplete = vi.fn();
      render(<LottieMoment src="/lottie/pick-drop.lottie" fallback={still} onComplete={onComplete} timeoutMs={500} />);
      await act(async () => vi.advanceTimersByTimeAsync(499));
      expect(onComplete).not.toHaveBeenCalled();
      await act(async () => vi.advanceTimersByTimeAsync(1));
      expect(onComplete).toHaveBeenCalledOnce();
      fire('complete'); // the real end arrives late
      expect(onComplete).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('never times out a loop', async () => {
    vi.useFakeTimers();
    try {
      const onComplete = vi.fn();
      render(<LottieMoment src="/lottie/listening.lottie" fallback={still} loop onComplete={onComplete} timeoutMs={100} />);
      await act(async () => vi.advanceTimersByTimeAsync(1000));
      expect(onComplete).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the still frame until the first frame is drawn, then shows only the animation', async () => {
    render(<LottieMoment src="/lottie/metronome.lottie" fallback={still} loop />);
    await screen.findByTestId('player');
    expect(screen.getByTestId('still')).toBeTruthy();
    fire('load');
    expect(screen.queryByTestId('still')).toBeNull();
  });
});
