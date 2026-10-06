import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Checkbox } from './Checkbox';

const meta: Meta<typeof Checkbox> = { title: 'Components/Checkbox', component: Checkbox };
export default meta;
type Story = StoryObj<typeof Checkbox>;

function Demo({ initial = true, disabled = false }: { initial?: boolean; disabled?: boolean }) {
  const [checked, setChecked] = useState(initial);
  return <Checkbox label="Fingering letters" checked={checked} onChange={setChecked} disabled={disabled} />;
}

export const Default: Story = { render: () => <Demo /> };
export const Unchecked: Story = { render: () => <Demo initial={false} /> };
export const Hover: Story = { render: () => <div data-force-state="hover"><Demo /></div> };
export const Focus: Story = {
  render: () => <Demo />,
  play: ({ canvasElement }) => {
    canvasElement.querySelector<HTMLInputElement>('input')?.focus();
  },
};
export const Disabled: Story = { render: () => <Demo disabled /> };
export const ReducedMotion: Story = { render: () => <Demo />, parameters: { reducedMotion: true } };
