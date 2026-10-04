import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SegmentedControl, type SegmentedControlProps } from './SegmentedControl';

const LEVELS = [
  { value: 'basic', label: 'Basic' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'advanced', label: 'Advanced' },
] as const;
type Level = (typeof LEVELS)[number]['value'];

function Stateful(props: Partial<SegmentedControlProps<Level>>) {
  const [value, setValue] = useState<Level>(props.value ?? 'basic');
  return <SegmentedControl label="Level" options={LEVELS} {...props} value={value} onChange={setValue} />;
}

const meta: Meta<typeof Stateful> = {
  title: 'Components/SegmentedControl',
  component: Stateful,
  argTypes: {
    tone: { control: 'inline-radio', options: ['primary', 'secondary'] },
  },
};
export default meta;
type Story = StoryObj<typeof Stateful>;

/** Level switch: the pill slides with a slight overshoot. */
export const Default: Story = {};

/** White pill, for mix and speed in the player bar. */
export const Secondary: Story = {
  render: () => {
    const Mix = () => {
      const [mix, setMix] = useState('both');
      return (
        <SegmentedControl
          label="Mix"
          tone="secondary"
          options={[
            { value: 'sheet', label: 'Sheet' },
            { value: 'original', label: 'Original' },
            { value: 'both', label: 'Both' },
          ]}
          value={mix}
          onChange={setMix}
        />
      );
    };
    return <Mix />;
  },
};

export const FullWidth: Story = {
  args: { fullWidth: true },
  decorators: [(Story) => <div style={{ width: 420 }}>{Story()}</div>],
};

export const Hover: Story = {
  decorators: [(Story) => <div data-force-state="hover">{Story()}</div>],
};

export const Focus: Story = {
  play: ({ canvasElement }) => {
    canvasElement.querySelector<HTMLInputElement>('input:checked')?.focus();
  },
};

export const Disabled: Story = { args: { disabled: true, value: 'moderate' } };

export const ReducedMotion: Story = { parameters: { reducedMotion: true } };
