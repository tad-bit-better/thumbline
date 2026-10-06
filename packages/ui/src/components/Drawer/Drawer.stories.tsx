import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button } from '../Button/Button';
import { SegmentedControl } from '../SegmentedControl/SegmentedControl';
import { Drawer } from './Drawer';

const LEVELS = [
  { value: 'basic', label: 'Basic' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'advanced', label: 'Advanced' },
] as const;

function Demo({ startOpen = false }: { startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const [level, setLevel] = useState<'basic' | 'moderate' | 'advanced'>('moderate');
  return (
    <>
      <Button onClick={() => setOpen(true)}>Customize</Button>
      <Drawer open={open} title="Customize" onClose={() => setOpen(false)}>
        <SegmentedControl label="Level" options={LEVELS} value={level} onChange={setLevel} />
      </Drawer>
    </>
  );
}

const meta: Meta = { title: 'Components/Drawer' };
export default meta;
type Story = StoryObj;

export const Default: Story = { render: () => <Demo /> };
export const Open: Story = { render: () => <Demo startOpen /> };
/** Under 720px it rises from the bottom. */
export const Phone: Story = { render: () => <Demo startOpen />, globals: { viewport: { value: 'mobile1' } } };
export const ReducedMotion: Story = { render: () => <Demo startOpen />, parameters: { reducedMotion: true } };
