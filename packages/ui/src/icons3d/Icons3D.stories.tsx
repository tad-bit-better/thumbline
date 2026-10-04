import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card } from '../components/Card/Card';
import { ICONS_3D } from './index';

const meta: Meta = { title: 'Foundations/3D icons' };
export default meta;

const grid = { display: 'grid', gridTemplateColumns: 'repeat(3, 160px)', gap: 'var(--space-4)' } as const;
const caption = { margin: 'var(--space-2) 0 0', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-mono)' } as const;

/** The v1 set at 96px. */
export const Gallery: StoryObj = {
  render: () => (
    <div style={grid}>
      {Object.entries(ICONS_3D).map(([name, Icon]) => (
        <Card key={name} padding="sm" style={{ textAlign: 'center' }}>
          <Icon size={96} />
          <p style={caption}>{name}</p>
        </Card>
      ))}
    </div>
  ),
};

/** 32, 48, 64 and 128px. */
export const Sizes: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'end' }}>
      {[32, 48, 64, 128].map((s) => (
        <ICONS_3D.Arpeggio key={s} size={s} />
      ))}
    </div>
  ),
};

/** Inside an interactive card the icon tilts −8° and scales 1.06. */
export const HoverTilt: StoryObj = {
  render: () => (
    <div data-force-state="hover" style={grid}>
      {(['Arpeggio', 'Fingerstyle', 'Flamenco'] as const).map((name) => {
        const Icon = ICONS_3D[name];
        return (
          <Card key={name} interactive padding="sm" style={{ textAlign: 'center' }}>
            <Icon size={96} />
            <p style={caption}>{name}</p>
          </Card>
        );
      })}
    </div>
  ),
};

export const ReducedMotion: StoryObj = { ...HoverTilt, parameters: { reducedMotion: true } };
