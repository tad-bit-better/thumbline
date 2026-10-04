import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button } from '../Button/Button';
import { Dialog } from './Dialog';

function Demo({ startOpen = false }: { startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        New song
      </Button>
      <Dialog
        open={open}
        title="Start a new song?"
        onClose={() => setOpen(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Keep this one
            </Button>
            <Button onClick={() => setOpen(false)}>Start over</Button>
          </>
        }
      >
        Your current sheet and chord edits will be cleared. Your audio never left this device.
      </Dialog>
    </>
  );
}

const meta: Meta<typeof Dialog> = { title: 'Components/Dialog', component: Dialog, parameters: { layout: 'fullscreen' } };
export default meta;
type Story = StoryObj<typeof Dialog>;

export const Default: Story = { render: () => <Demo /> };

/** Pops from 92% scale with a bounce; Escape and the close button dismiss it. */
export const Open: Story = { render: () => <Demo startOpen /> };

export const ReducedMotion: Story = { render: () => <Demo startOpen />, parameters: { reducedMotion: true } };
