import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SectionNav, type SectionNavProps } from './SectionNav';

const ITEMS = [
  { id: '0', title: 'Section A', detail: 'Bars 1–8' },
  { id: '8', title: 'Section B', detail: 'Bars 9–16' },
  { id: '16', title: 'Section A', detail: 'Bars 17–24' },
  { id: '24', title: 'Section C', detail: 'Bars 25–28' },
];

function Demo(props: Partial<SectionNavProps>) {
  const [current, setCurrent] = useState('8');
  return (
    <div style={{ width: props.variant === 'chips' ? 360 : 220 }}>
      <SectionNav label="Sections" items={ITEMS} current={current} onSelect={setCurrent} {...props} />
    </div>
  );
}

const meta: Meta = { title: 'Components/SectionNav' };
export default meta;
type Story = StoryObj;

export const Default: Story = { render: () => <Demo /> };
export const Chips: Story = { render: () => <Demo variant="chips" /> };
export const Hover: Story = { render: () => <div data-force-state="hover"><Demo /></div> };
export const Focus: Story = {
  render: () => <Demo />,
  play: ({ canvasElement }) => {
    canvasElement.querySelector<HTMLButtonElement>('button')?.focus();
  },
};
export const ReducedMotion: Story = { render: () => <Demo />, parameters: { reducedMotion: true } };
