import type { Arrangement } from '@thumbline/engine';
import { type Beats, type Mix, type Player, type PlayerState, createPlayer } from '@thumbline/playback';
import { useCallback, useEffect, useRef, useState } from 'react';
import { audioContext, decodeOriginal, decodeWhenIdle, rest, wake } from './original-audio';

type Options = {
  arrangement: Arrangement | null;
  beats?: Beats;
  /** The recording's tuning (cents from A440), so the sheet plays in tune with it. */
  tuningCents?: number;
  /** The original clip; decoded once, on the first play. */
  file: Blob | null;
  mix: Mix;
  /** The original under the sheet in Both, 0–1. */
  originalLevel: number;
  speed: number;
  loop: boolean;
  /** Played to the end; `wholeSong` is false if it started (or jumped) past the first bar. */
  onEnd?: (wholeSong: boolean) => void;
};

/**
 * Owns the audio for the Sheet screen: the shared AudioContext (woken inside
 * the Play click, as browsers require), the original decoded while the page is
 * idle, and a player rebuilt whenever the arrangement changes. Keeps the song position
 * (in ticks) so Pause resumes where it stopped and seeking works while paused.
 */
export function useSheetPlayer({ arrangement, beats, tuningCents, file, mix, originalLevel, speed, loop, onEnd }: Options) {
  const [state, setState] = useState<PlayerState>('idle');
  const [cursor, setCursor] = useState<number | undefined>();
  /** Where Play resumes from, in ticks: the last note heard, or where the user seeked to. */
  const [position, setPosition] = useState(0);
  /** The current run started at the top and hasn't jumped: reaching the end is a whole-song play. */
  const whole = useRef(true);
  const player = useRef<Player | null>(null);
  const latest = useRef({ mix, originalLevel, speed, loop, onEnd });
  latest.current = { mix, originalLevel, speed, loop, onEnd };

  useEffect(
    () => () => {
      player.current?.dispose();
      player.current = null;
      setState('idle');
      setCursor(undefined);
    },
    [arrangement],
  );
  const events = arrangement?.events;
  const indexAt = (tick: number) => {
    if (!events?.length) return undefined;
    const i = events.findIndex((e) => e.tick >= tick);
    return i < 0 ? events.length - 1 : i;
  };

  useEffect(() => {
    player.current?.setMix(mix);
  }, [mix]);
  useEffect(() => {
    player.current?.setOriginalLevel(originalLevel);
  }, [originalLevel]);
  useEffect(() => {
    void player.current?.setTempoRatio(speed);
  }, [speed]);
  useEffect(() => {
    if (arrangement) player.current?.setLoop(loop ? 0 : null, arrangement.bars - 1);
  }, [loop, arrangement]);

  const ensure = async (a: Arrangement) => {
    if (player.current) return player.current;
    const ctx = audioContext();
    const original = file ? await decodeOriginal(file) : undefined;
    const p = createPlayer({
      arrangement: a,
      original,
      beats,
      tuningCents,
      context: ctx,
      onCursor: (i) => {
        setCursor(i);
        setPosition(a.events[i]?.tick ?? 0);
      },
      onEnd: () => {
        setPosition(0);
        setCursor(undefined);
        latest.current.onEnd?.(whole.current);
      },
      onStateChange: setState,
    });
    p.setMix(latest.current.mix);
    p.setOriginalLevel(latest.current.originalLevel);
    await p.setTempoRatio(latest.current.speed);
    if (latest.current.loop) p.setLoop(0, a.bars - 1);
    player.current = p;
    return p;
  };

  // Decode the clip while the page is idle, so Play starts at once.
  useEffect(() => (file ? decodeWhenIdle(file) : undefined), [file]);
  useEffect(() => rest, []);

  const playFrom = async (tick: number) => {
    if (!arrangement) return;
    // Inside the click, before any await: browsers let sound start only from a gesture.
    wake();
    setState('preparing');
    try {
      const p = await ensure(arrangement);
      await p.playFrom(tick);
    } catch {
      setState('idle');
    }
  };
  /** Play from where it was paused (or the start). */
  const play = () => {
    whole.current = position === 0;
    return playFrom(position);
  };
  /** Pause: Play resumes from here. */
  const stop = useCallback(() => player.current?.stop(), []);
  const toggle = () => (state === 'idle' ? play() : stop());
  /**
   * Move to `tick`. While playing, playback jumps there; otherwise the
   * playhead moves and Play starts from there, or playback starts at once with `andPlay`.
   */
  const seek = (tick: number, andPlay = false) => {
    const t = Math.max(0, tick);
    setPosition(t);
    setCursor(indexAt(t));
    if (state !== 'playing' && !andPlay) return Promise.resolve();
    whole.current = t === 0;
    return playFrom(t);
  };

  return { state, cursor, position, play, stop, toggle, seek };
}
