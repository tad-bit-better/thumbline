import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect } from 'react';
import { Button } from '../Button/Button';
import { ToastProvider, useToast } from './Toast';

function Buttons({ auto = false }: { auto?: boolean }) {
  const toast = useToast();
  useEffect(() => {
    if (auto) toast({ message: 'Chord changed to Am', tone: 'success' });
  }, [auto, toast]);
  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
      <Button variant="secondary" onClick={() => toast({ message: 'Sheet copied' })}>
        Neutral
      </Button>
      <Button variant="secondary" onClick={() => toast({ message: 'Chord changed to Am', tone: 'success' })}>
        Success
      </Button>
      <Button variant="secondary" onClick={() => toast({ message: 'F needs a barre at this capo', tone: 'warning' })}>
        Warning
      </Button>
    </div>
  );
}

const meta: Meta = {
  title: 'Components/Toast',
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <ToastProvider>
        <div style={{ minHeight: 280, display: 'grid', placeItems: 'center' }}>{Story()}</div>
      </ToastProvider>
    ),
  ],
};
export default meta;

export const Default: StoryObj = { render: () => <Buttons /> };

/** Rises 14px and fades in; announced politely. */
export const Showing: StoryObj = { render: () => <Buttons auto /> };

export const ReducedMotion: StoryObj = { render: () => <Buttons auto />, parameters: { reducedMotion: true } };
