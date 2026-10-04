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
  onEnd?: () => void;
};

/**
 * Owns the audio for the Sheet screen: one AudioContext (created on the first
 * Play, inside the click, as browsers require), the decoded original, and a
 * player rebuilt whenever the arrangement changes.
 */
export function useSheetPlayer({ arrangement, beats, file, mix, speed, loop, onEnd }: Options) {
  const [state, setState] = useState<PlayerState>('idle');
  const [cursor, setCursor] = useState<number | undefined>();
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
      onCursor: setCursor,
      onEnd: () => latest.current.onEnd?.(),
      onStateChange: setState,
    });
    p.setMix(latest.current.mix);
    await p.setTempoRatio(latest.current.speed);
    if (latest.current.loop) p.setLoop(0, a.bars - 1);
    player.current = p;
    return p;
  };

  const play = async (fromBar?: number) => {
    if (!arrangement) return;
    setState('preparing');
    try {
      const p = await ensure(arrangement);
      await p.play(fromBar);
    } catch {
      setState('idle');
    }
  };
  const stop = () => player.current?.stop();
  const toggle = () => (state === 'idle' ? play() : stop());

  return { state, cursor, play, stop, toggle };
}
