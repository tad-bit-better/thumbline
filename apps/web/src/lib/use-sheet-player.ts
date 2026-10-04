import type { Arrangement } from '@thumbline/engine';
import { type Beats, type Mix, type Player, type PlayerState, createPlayer } from '@thumbline/playback';
import { useEffect, useRef, useState } from 'react';

type Options = {
  arrangement: Arrangement | null;
  beats?: Beats;
  /** The original clip; decoded once, on the first play. */
  file: Blob | null;
  mix: Mix;
  speed: number;
  loop: boolean;
  /** Played to the end; `wholeSong` is false if it started (or jumped) past the first bar. */
  onEnd?: (wholeSong: boolean) => void;
};

/**
 * Owns the audio for the Sheet screen: one AudioContext (created on the first
 * Play, inside the click, as browsers require), the decoded original, and a
 * player rebuilt whenever the arrangement changes. Keeps the song position
 * (in ticks) so Pause resumes where it stopped and seeking works while paused.
 */
export function useSheetPlayer({ arrangement, beats, file, mix, speed, loop, onEnd }: Options) {
  const [state, setState] = useState<PlayerState>('idle');
  const [cursor, setCursor] = useState<number | undefined>();
  /** Where Play resumes from, in ticks: the last note heard, or where the user seeked to. */
  const [position, setPosition] = useState(0);
  /** The current run started at the top and hasn't jumped: reaching the end is a whole-song play. */
  const whole = useRef(true);
  const context = useRef<AudioContext | null>(null);
  const decoded = useRef<{ file: Blob; buffer: AudioBuffer } | null>(null);
  const player = useRef<Player | null>(null);
  const latest = useRef({ mix, speed, loop, onEnd });
  latest.current = { mix, speed, loop, onEnd };

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
    void player.current?.setTempoRatio(speed);
  }, [speed]);
  useEffect(() => {
    if (arrangement) player.current?.setLoop(loop ? 0 : null, arrangement.bars - 1);
  }, [loop, arrangement]);

  const ensure = async (a: Arrangement) => {
    if (player.current) return player.current;
    const ctx = (context.current ??= new AudioContext({ latencyHint: 'interactive' }));
    let original: AudioBuffer | undefined;
    if (file) {
      if (decoded.current?.file !== file) decoded.current = { file, buffer: await ctx.decodeAudioData(await file.arrayBuffer()) };
      original = decoded.current.buffer;
    }
    const p = createPlayer({
      arrangement: a,
      original,
      beats,
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
    await p.setTempoRatio(latest.current.speed);
    if (latest.current.loop) p.setLoop(0, a.bars - 1);
    player.current = p;
    return p;
  };

  const playFrom = async (tick: number) => {
    if (!arrangement) return;
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
  const stop = () => player.current?.stop();
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
