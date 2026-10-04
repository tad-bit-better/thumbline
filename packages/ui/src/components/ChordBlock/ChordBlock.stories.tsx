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

function GridDemo() {
  const [status, setStatus] = useState<Record<number, ChordBlockStatus>>({ 5: 'low', 12: 'low' });
  const chords = ['G', 'G', 'D', 'D', 'Em', 'Em', 'C', 'C', 'G', 'G', 'D', 'D', 'Am', 'C', 'D', 'D'];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 80px)', gap: 'var(--space-2)' }}>
      {chords.map((c, i) => (
        <ChordBlock
          key={i}
          bar={i + 1}
          chord={c}
          status={status[i] ?? 'normal'}
          onClick={() => status[i] === 'low' && setStatus({ ...status, [i]: 'confirmed' })}
        />
      ))}
    </div>
  );
}

/** Click an orange block to confirm it. */
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

export const Disabled: Story = { args: { disabled: true } };

export const ReducedMotion: Story = { args: { status: 'low', chord: 'Em' }, parameters: { reducedMotion: true } };
