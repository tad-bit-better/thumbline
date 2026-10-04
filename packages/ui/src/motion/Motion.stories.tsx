import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import styles from './Motion.module.css';
import { PressScale } from './PressScale';
import { Pulse } from './Pulse';
import { Reveal } from './Reveal';
import { LOOP_MS } from './springs';

const meta: Meta = { title: 'Foundations/Motion' };
export default meta;

function RevealDemo() {
  const [key, setKey] = useState(0);
  return (
    <div style={{ display: 'grid', gap: 'var(--space-4)', justifyItems: 'start' }}>
      <Reveal revealKey={key} className={styles['row']}>
        {[0, 2, 3, 2, 1, 0, 3, 2, 0, 1, 3, 2].map((f, i) => (
          <span key={i} className={styles['note']}>
            {f}
          </span>
        ))}
      </Reveal>
      <button type="button" onClick={() => setKey((k) => k + 1)}>
        Replay
      </button>
    </div>
  );
}

/** Notes pop in left to right (moment #5). */
export const RevealNotes: StoryObj = { render: () => <RevealDemo /> };
export const RevealReducedMotion: StoryObj = {
  render: () => <RevealDemo />,
  parameters: { reducedMotion: true },
};

/** Idle play button. */
export const PulseBreathe: StoryObj = {
  render: () => (
    <Pulse>
      <span className={styles['sphere']} />
    </Pulse>
  ),
};

/** Low-confidence attention dot. */
export const PulsePing: StoryObj = {
  render: () => (
    <Pulse variant="ping" periodMs={LOOP_MS.ping} className={styles['dot']}>
      <span />
    </Pulse>
  ),
};

export const PulseReducedMotion: StoryObj = {
  ...PulsePing,
  parameters: { reducedMotion: true },
};

export const PressScaleCard: StoryObj = {
  render: () => (
    <PressScale className={styles['card']}>Press and hold</PressScale>
  ),
};
