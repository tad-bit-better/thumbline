import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ChordBlock, type ChordBlockStatus } from './ChordBlock';

const meta: Meta<typeof ChordBlock> = {
  title: 'Components/ChordBlock',
  component: ChordBlock,
  args: { bar: 3, chord: 'Am', status: 'normal' },
  argTypes: { status: { control: 'inline-radio', options: ['normal', 'low', 'confirmed'] } },
  render: (args) => (
    <div style={{ width: 96, padding: 'var(--space-3)' }}>
      <ChordBlock {...args} />
    </div>
  ),
};
export default meta;
type Story = StoryObj<typeof ChordBlock>;

export const Default: Story = {};
export const LowConfidence: Story = { args: { status: 'low', chord: 'Em' } };
export const Open: Story = { args: { status: 'low', chord: 'Em', open: true } };
export const Confirmed: Story = { args: { status: 'confirmed', chord: 'G' } };
export const NoChord: Story = { args: { chord: null } };

/** With its start time, a section letter and a play button. */
export const WithTime: Story = { args: { time: '0:24', section: 'A', onPlay: () => undefined } };
export const Playing: Story = { args: { time: '0:24', section: 'A', onPlay: () => undefined, playing: true } };

const clock = (bar: number) => `0:${String(bar * 2).padStart(2, '0')}`;

function GridDemo() {
  const [status, setStatus] = useState<Record<number, ChordBlockStatus>>({ 5: 'low', 12: 'low' });
  const [playing, setPlaying] = useState<number | null>(null);
  const chords = ['G', 'G', 'D', 'D', 'Em', 'Em', 'C', 'C', 'G', 'G', 'D', 'D', 'Am', 'C', 'D', 'D'];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 80px)', gap: 'var(--space-2)' }}>
      {chords.map((c, i) => (
        <ChordBlock
          key={i}
          bar={i + 1}
          chord={c}
          time={clock(i)}
          section={i % 8 === 0 ? 'A' : undefined}
          status={status[i] ?? 'normal'}
          onClick={() => status[i] === 'low' && setStatus({ ...status, [i]: 'confirmed' })}
          onPlay={() => setPlaying(playing === i ? null : i)}
          playing={playing === i}
        />
      ))}
    </div>
  );
}

/** Click an orange block to confirm it; the round buttons play and stop a bar (here, just the state). */
export const Grid: Story = {
  render: () => <GridDemo />,
  decorators: [(Story) => <div style={{ padding: 'var(--space-3)' }}>{Story()}</div>],
};

export const Hover: Story = { decorators: [(Story) => <div data-force-state="hover">{Story()}</div>] };

export const Focus: Story = {
  play: ({ canvasElement }) => {
    canvasElement.querySelector('button')?.focus();
  },
};

export const Disabled: Story = { args: { disabled: true, time: '0:24', onPlay: () => undefined } };

export const ReducedMotion: Story = { args: { status: 'low', chord: 'Em' }, parameters: { reducedMotion: true } };

/** Playing, with the waveform held still. */
export const PlayingReducedMotion: Story = {
  args: { time: '0:24', onPlay: () => undefined, playing: true },
  parameters: { reducedMotion: true },
};

export const PlayFocus: Story = {
  args: { time: '0:24', onPlay: () => undefined },
  play: ({ canvasElement }) => {
    canvasElement.querySelector<HTMLButtonElement>('button[aria-pressed]')?.focus();
  },
};
