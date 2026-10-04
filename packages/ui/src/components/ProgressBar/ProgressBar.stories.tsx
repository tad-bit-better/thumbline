import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';
import { ProgressBar } from './ProgressBar';

const meta: Meta<typeof ProgressBar> = {
  title: 'Components/ProgressBar',
  component: ProgressBar,
  args: { label: 'Listening to your song', value: 0.42 },
  argTypes: { value: { control: { type: 'range', min: 0, max: 1, step: 0.01 } } },
  decorators: [(Story) => <div style={{ width: 420 }}>{Story()}</div>],
};
export default meta;
type Story = StoryObj<typeof ProgressBar>;

export const Default: Story = {};

/** No value yet: a segment slides along the track. */
export const Indeterminate: Story = { args: { value: undefined, label: 'Decoding the audio' } };

function Running() {
  const [v, setV] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setV((x) => (x >= 1 ? 0 : x + 0.05)), 400);
    return () => clearInterval(t);
  }, []);
  return <ProgressBar label="Hearing the chords" value={v} valueText={`bar ${Math.round(v * 48)} of 48`} />;
}

/** Width eases with glide as the value grows. */
export const Live: Story = { render: () => <Running /> };

export const ReducedMotion: Story = { parameters: { reducedMotion: true } };
