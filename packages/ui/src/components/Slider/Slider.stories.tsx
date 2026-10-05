import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ReducedMotionProvider } from '../../motion';
import { Slider, type SliderProps } from './Slider';

function Stateful(props: Partial<SliderProps>) {
  const [value, setValue] = useState(props.value ?? 0.3);
  return <Slider label="Energy" minLabel="Calm" maxLabel="Driving" {...props} value={value} onChange={setValue} />;
}

const meta: Meta<typeof Stateful> = {
  title: 'Components/Slider',
  component: Stateful,
};
export default meta;
type Story = StoryObj<typeof Stateful>;

/** Energy: calm → driving. */
export const Default: Story = {};

/** Colour: dark → bright, with words for screen readers. */
export const WithValueText: Story = {
  args: { label: 'Colour', minLabel: 'Dark', maxLabel: 'Bright', value: 0.7, valueText: (v: number) => (v < 0.5 ? 'dark' : 'bright') },
};

/** Hover and focus use the native thumb with the violet tint and the focus ring. */
export const Focus: Story = { play: async ({ canvasElement }) => canvasElement.querySelector('input')?.focus() };

export const Disabled: Story = { args: { disabled: true } };

/** Nothing animates, so reduced motion looks the same. */
export const ReducedMotion: Story = {
  render: (args) => (
    <ReducedMotionProvider reduced>
      <Stateful {...args} />
    </ReducedMotionProvider>
  ),
};
