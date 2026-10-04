import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button } from '../components/Button/Button';
import { Metronome, Pick } from '../icons3d';
import { LottieMoment } from './LottieMoment';

const meta: Meta<typeof LottieMoment> = { title: 'Foundations/LottieMoment', component: LottieMoment };
export default meta;
type Story = StoryObj<typeof LottieMoment>;

/** No .lottie file yet (M8): the designed still frame shows. */
export const StillFrame: Story = {
  args: { fallback: <Metronome size={120} />, label: 'Metronome at 92 bpm', loop: true },
};

/** A missing or broken file falls back to the still frame and still completes. */
export const LoadError: Story = {
  render: () => {
    const Demo = () => {
      const [done, setDone] = useState(0);
      return (
        <div style={{ display: 'grid', gap: 'var(--space-3)', justifyItems: 'center' }}>
          <LottieMoment src="/lottie/does-not-exist.lottie" fallback={<Pick size={120} />} onComplete={() => setDone((n) => n + 1)} />
          <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-mono)' }}>completed {done}×</p>
        </div>
      );
    };
    return <Demo />;
  },
};

/** One-shot moments replay when playKey changes. */
export const Replay: Story = {
  render: () => {
    const Demo = () => {
      const [key, setKey] = useState(0);
      return (
        <div style={{ display: 'grid', gap: 'var(--space-3)', justifyItems: 'center' }}>
          <LottieMoment playKey={key} fallback={<Pick size={120} />} />
          <Button variant="secondary" onClick={() => setKey((k) => k + 1)}>
            Drop again
          </Button>
        </div>
      );
    };
    return <Demo />;
  },
};

export const ReducedMotion: Story = { ...StillFrame, parameters: { reducedMotion: true } };
