import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ChordPicker } from './ChordPicker';

const meta: Meta<typeof ChordPicker> = { title: 'Components/ChordPicker', component: ChordPicker };
export default meta;
type Story = StoryObj<typeof ChordPicker>;

const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const QUALITIES = [
  { value: 'maj', label: 'Major' },
  { value: 'm', label: 'Minor' },
  { value: '7', label: '7' },
  { value: 'm7', label: 'm7' },
  { value: 'maj7', label: 'maj7' },
  { value: 'sus4', label: 'sus4' },
];

function Demo({ split = false }: { split?: boolean }) {
  const [hearing, setHearing] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const choices = (heard: string, rest: string[]) => [
    { id: heard, name: heard, tag: picked === heard ? ('yours' as const) : ('heard' as const), strength: 1 },
    ...rest.map((name, i) => ({ id: name, name, tag: picked === name ? ('yours' as const) : undefined, strength: 0.6 - i * 0.2 })),
  ];
  return (
    <div style={{ width: 340, padding: 'var(--space-3)', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-card)' }}>
      <ChordPicker
        title="Bar 5"
        groups={
          split
            ? [
                { id: 'a', label: 'Beats 1–2', choices: choices('G', ['Em']) },
                { id: 'b', label: 'Beats 3–4', choices: choices('D', ['Bm']) },
              ]
            : [{ id: 'a', choices: choices('Am', ['C', 'F']) }]
        }
        onPick={(_, id) => setPicked(id)}
        other={{ roots: ROOTS, qualities: QUALITIES, nameOf: (r, q) => ROOTS[r] + (q === 'maj' ? '' : q), onPick: (_, r, q) => setPicked(ROOTS[r] + q) }}
        onHear={() => setHearing(!hearing)}
        hearing={hearing}
        onNext={() => undefined}
        nextLabel="Next to check (3 left)"
      />
    </div>
  );
}

export const Default: Story = { render: () => <Demo /> };
export const BarThatChanges: Story = { render: () => <Demo split /> };
export const Hover: Story = { render: () => <div data-force-state="hover"><Demo /></div> };
export const Focus: Story = {
  render: () => <Demo />,
  play: ({ canvasElement }) => {
    canvasElement.querySelectorAll<HTMLButtonElement>('button')[1]?.focus();
  },
};
export const ReducedMotion: Story = { render: () => <Demo />, parameters: { reducedMotion: true } };
