import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { type StyleKind, StyleCard } from './StyleCard';

const STYLES: Array<{ kind: StyleKind; title: string; hint: string; sublabel?: string }> = [
  { kind: 'arpeggio', title: 'Arpeggio', hint: 'Notes of the chord one after another, rolling up and down.' },
  { kind: 'fingerstyle', title: 'Fingerstyle', hint: 'Thumb keeps the bass while the fingers play the tune around it.' },
  { kind: 'flamenco', title: 'Flamenco', hint: 'Rasgueado fans and thumb accents, rumba feel.', sublabel: 'Rumba' },
];

function Row({ disabled = false }: { disabled?: boolean }) {
  const [style, setStyle] = useState<StyleKind>('fingerstyle');
  return (
    <div role="radiogroup" aria-label="Style" style={{ display: 'flex', gap: 'var(--space-4)', paddingTop: 'var(--space-3)' }}>
      {STYLES.map((s) => (
        <StyleCard key={s.kind} {...s} name="style" selected={style === s.kind} onSelect={() => setStyle(s.kind)} disabled={disabled} />
      ))}
    </div>
  );
}

const meta: Meta<typeof StyleCard> = { title: 'Components/StyleCard', component: StyleCard };
export default meta;
type Story = StoryObj<typeof StyleCard>;

/** Style row on the Sheet screen: a radio group of cards. */
export const Default: Story = { render: () => <Row /> };

/** Informational cards on the Upload screen. */
export const Static: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
      {STYLES.map((s) => (
        <StyleCard key={s.kind} {...s} />
      ))}
    </div>
  ),
};

export const Hover: Story = { render: () => <div data-force-state="hover"><Row /></div> };

export const Focus: Story = {
  render: () => <Row />,
  play: ({ canvasElement }) => {
    canvasElement.querySelector<HTMLInputElement>('input:checked')?.focus();
  },
};

export const Disabled: Story = { render: () => <Row disabled /> };

export const ReducedMotion: Story = { ...Hover, parameters: { reducedMotion: true } };
