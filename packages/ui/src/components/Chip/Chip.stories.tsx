import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Chip } from './Chip';

const meta: Meta<typeof Chip> = {
  title: 'Components/Chip',
  component: Chip,
  args: { children: 'Capo on the 2nd fret', tone: 'neutral', font: 'sans' },
  argTypes: {
    tone: { control: 'inline-radio', options: ['neutral', 'violet', 'orange', 'mint', 'rose'] },
    font: { control: 'inline-radio', options: ['sans', 'mono'] },
  },
};
export default meta;
type Story = StoryObj<typeof Chip>;

export const Default: Story = {};

export const Tones: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
      <Chip>No capo needed</Chip>
      <Chip tone="violet">G major · 4/4</Chip>
      <Chip tone="orange">2 chords to check</Chip>
      <Chip tone="mint">All chords checked</Chip>
      <Chip tone="rose">golpe</Chip>
      <Chip font="mono">wonderwall.mp3 · 3:12</Chip>
      <Chip font="mono" tone="violet">
        92 bpm
      </Chip>
    </div>
  ),
};

function ToggleDemo({ disabled = false }: { disabled?: boolean }) {
  const [palo, setPalo] = useState('rumba');
  return (
    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
      {['rumba', 'tangos'].map((p) => (
        <Chip key={p} onClick={() => setPalo(p)} selected={palo === p} disabled={disabled}>
          {p[0].toUpperCase() + p.slice(1)}
        </Chip>
      ))}
    </div>
  );
}

/** With onClick a chip is a toggle button (flamenco palo picker). */
export const Toggle: Story = { render: () => <ToggleDemo /> };

export const Hover: Story = {
  render: () => (
    <div data-force-state="hover">
      <ToggleDemo />
    </div>
  ),
};

export const Focus: Story = {
  render: () => <ToggleDemo />,
  play: ({ canvasElement }) => {
    canvasElement.querySelector('button')?.focus();
  },
};

export const Disabled: Story = { render: () => <ToggleDemo disabled /> };

export const ReducedMotion: Story = { ...Hover, parameters: { reducedMotion: true } };
