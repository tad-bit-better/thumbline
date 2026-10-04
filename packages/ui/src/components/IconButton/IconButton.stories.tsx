import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { CloseGlyph, LoopGlyph, PlayGlyph } from '../glyphs';
import { IconButton } from './IconButton';

const meta: Meta<typeof IconButton> = {
  title: 'Components/IconButton',
  component: IconButton,
  args: { label: 'Loop', icon: <LoopGlyph />, variant: 'secondary' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'ghost'] },
    icon: { control: false },
  },
};
export default meta;
type Story = StoryObj<typeof IconButton>;

export const Default: Story = {};

export const Variants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
      <IconButton label="Play" icon={<PlayGlyph />} variant="primary" />
      <IconButton label="Loop" icon={<LoopGlyph />} variant="secondary" />
      <IconButton label="Close" icon={<CloseGlyph />} variant="ghost" />
    </div>
  ),
};

function ToggleDemo() {
  const [on, setOn] = useState(true);
  return <IconButton label="Loop" icon={<LoopGlyph />} pressed={on} onClick={() => setOn(!on)} />;
}

/** `pressed` makes it a toggle with aria-pressed. */
export const Toggle: Story = { render: () => <ToggleDemo /> };

export const Hover: Story = {
  render: (args) => (
    <div data-force-state="hover">
      <IconButton {...args} />
    </div>
  ),
};

export const Focus: Story = {
  play: ({ canvasElement }) => {
    canvasElement.querySelector('button')?.focus();
  },
};

export const Disabled: Story = { args: { disabled: true } };

export const ReducedMotion: Story = { ...Hover, parameters: { reducedMotion: true } };
