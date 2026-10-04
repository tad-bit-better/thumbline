import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button } from '../Button/Button';
import { Popover } from './Popover';

const ALTERNATIVES = [
  { name: 'Am', p: 0.58 },
  { name: 'C', p: 0.27 },
  { name: 'Em', p: 0.15 },
];

const row = {
  display: 'grid',
  gridTemplateColumns: '48px 1fr 40px',
  alignItems: 'center',
  gap: 'var(--space-3)',
  width: '100%',
  minHeight: 44,
  padding: '0 var(--space-3)',
  border: 0,
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  font: 'inherit',
  color: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
} as const;

function Demo() {
  const [chord, setChord] = useState('Am');
  return (
    <Popover
      label="Alternatives for bar 3"
      trigger={(props) => (
        <Button variant="secondary" {...props}>
          Bar 3: {chord}
        </Button>
      )}
    >
      {({ close }) => (
        <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
          <p style={{ margin: '0 var(--space-3) var(--space-2)', fontSize: 'var(--text-small)', color: 'var(--color-ink-2)' }}>
            Pick the chord you hear
          </p>
          {ALTERNATIVES.map((a) => (
            <button
              key={a.name}
              type="button"
              style={row}
              onClick={() => {
                setChord(a.name);
                close();
              }}
            >
              <strong>{a.name}</strong>
              <span style={{ height: 8, borderRadius: 'var(--radius-pill)', background: 'var(--color-violet-soft)' }}>
                <span
                  style={{ display: 'block', height: '100%', width: `${a.p * 100}%`, borderRadius: 'inherit', background: 'var(--color-violet)' }}
                />
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-mono)' }}>{Math.round(a.p * 100)}%</span>
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}

const meta: Meta<typeof Popover> = { title: 'Components/Popover', component: Popover };
export default meta;
type Story = StoryObj<typeof Popover>;

/** Chord alternatives: pops from 92% scale and 8px down, origin at the trigger. */
export const Default: Story = { render: () => <Demo /> };

export const Open: Story = {
  render: () => <Demo />,
  play: ({ canvasElement }) => {
    canvasElement.querySelector('button')?.click();
  },
};

export const ReducedMotion: Story = { ...Open, parameters: { reducedMotion: true } };
