import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { RadioList } from './RadioList';

const meta: Meta = { title: 'Components/RadioList' };
export default meta;

const OPTIONS = [
  { value: 'auto', label: 'Auto', hint: 'As the rest of the song' },
  { value: 'ballad', label: 'Ballad' },
  { value: 'travis', label: 'Travis picking' },
  { value: 'pinch', label: 'Pinch and roll' },
];

function Demo({ disabled = false }: { disabled?: boolean }) {
  const [value, setValue] = useState('auto');
  return (
    <div style={{ width: 300 }}>
      <RadioList label="Pattern" options={OPTIONS} value={value} onChange={setValue} disabled={disabled} />
    </div>
  );
}

export const Default: StoryObj = { render: () => <Demo /> };
export const Hover: StoryObj = { render: () => <div data-force-state="hover"><Demo /></div> };
export const Focus: StoryObj = {
  render: () => <Demo />,
  play: ({ canvasElement }) => {
    canvasElement.querySelector<HTMLInputElement>('input')?.focus();
  },
};
export const Disabled: StoryObj = { render: () => <Demo disabled /> };
export const ReducedMotion: StoryObj = { render: () => <Demo />, parameters: { reducedMotion: true } };
