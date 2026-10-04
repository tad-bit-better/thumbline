import type { Meta, StoryObj } from '@storybook/react-vite';
import type { Level } from '@thumbline/engine';
import { Button, SegmentedControl } from '@thumbline/ui';
import { useEffect, useMemo, useState } from 'react';
import { longSheet, sheet } from '../testing/fixtures';
import { TabSheet } from './TabSheet';

const meta: Meta = { title: 'Tab/Playback and reveal' };
export default meta;

const card = {
  display: 'grid',
  gap: 'var(--space-4)',
  padding: 'var(--space-6)',
  background: 'var(--color-surface)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: 'var(--shadow-card)',
} as const;

const LEVELS = [
  { value: 'basic', label: 'Basic' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'advanced', label: 'Advanced' },
] as const;

function Player({ bars = 8, startPlaying = false }: { bars?: number; startPlaying?: boolean }) {
  const [level, setLevel] = useState<Level>('moderate');
  const arrangement = useMemo(
    () => (bars > 8 ? longSheet(bars, 'fingerstyle', level) : sheet('G | D | Em | C | G | D | C | C', 'fingerstyle', level)),
    [bars, level],
  );
  const [cursor, setCursor] = useState<number | undefined>(startPlaying ? 0 : undefined);
  const playing = cursor !== undefined;

  // Step through events at the arrangement's tempo (stand-in for the playback package).
  useEffect(() => {
    if (cursor === undefined) return;
    const e = arrangement.events;
    if (cursor >= e.length - 1) return;
    const ticks = e[cursor + 1].tick - e[cursor].tick;
    const ms = (ticks / 480) * (60000 / arrangement.bpm);
    const t = setTimeout(() => setCursor(cursor + 1), ms);
    return () => clearTimeout(t);
  }, [cursor, arrangement]);

  return (
    <section style={card}>
      <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
        <Button onClick={() => setCursor(playing ? undefined : 0)}>{playing ? 'Stop' : 'Play'}</Button>
        <SegmentedControl label="Level" options={LEVELS} value={level} onChange={(v) => setLevel(v)} />
      </div>
      <TabSheet arrangement={arrangement} width={1040} cursorIndex={cursor} label="Fingerstyle tab" />
    </section>
  );
}

/** Switch level to replay the reveal; press Play for the playhead. */
export const RevealAndPlay: StoryObj = { render: () => <Player /> };

/** The playhead mid-song, with its glow and the active notes lit. */
export const Playing: StoryObj = { render: () => <Player startPlaying /> };

/** Reveal is skipped and the playhead has no glow, but it still moves. */
export const ReducedMotion: StoryObj = { render: () => <Player startPlaying />, parameters: { reducedMotion: true } };

/** 200 bars while playing: only the active system re-renders per note. */
export const LongSongPlaying: StoryObj = { render: () => <Player bars={200} startPlaying /> };
