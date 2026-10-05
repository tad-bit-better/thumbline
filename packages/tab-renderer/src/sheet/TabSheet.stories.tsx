import type { Meta, StoryObj } from '@storybook/react-vite';
import type { Arrangement, Level, Style } from '@thumbline/engine';
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { longSheet, sheet, techniqueSheet } from '../testing/fixtures';
import { TabSheet, type TabSheetProps } from './TabSheet';

const card = {
  padding: 'var(--space-6)',
  background: 'var(--color-surface)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: 'var(--shadow-card)',
} as const;

function Card({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <section style={card}>
      {title && <h2 style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--text-h3)' }}>{title}</h2>}
      {children}
    </section>
  );
}

const meta: Meta<TabSheetProps> = {
  title: 'Tab/TabSheet',
  component: TabSheet,
  args: { width: 1040, showFingers: true, showTechniques: true },
  render: (args) => (
    <Card>
      <TabSheet {...args} />
    </Card>
  ),
};
export default meta;
type Story = StoryObj<TabSheetProps>;

const POP = 'G | D | Em | C | G | D | C | C';
const styleLevel = (style: Style, level: Level): Story => ({
  args: { arrangement: sheet(POP, style, level) },
});

export const ArpeggioBasic: Story = styleLevel('arpeggio', 'basic');
export const ArpeggioModerate: Story = styleLevel('arpeggio', 'moderate');
export const ArpeggioAdvanced: Story = styleLevel('arpeggio', 'advanced');
export const FingerstyleBasic: Story = styleLevel('fingerstyle', 'basic');
export const FingerstyleModerate: Story = styleLevel('fingerstyle', 'moderate');
export const FingerstyleAdvanced: Story = styleLevel('fingerstyle', 'advanced');

/** The Andalusian cadence in A minor, as the flamenco patterns play it. */
const ANDALUSIAN = 'Am | G | F | E | Am | G | F | E';
const A_MINOR = { pc: 9, mode: 'minor' } as const;
export const FlamencoRumbaBasic: Story = { args: { arrangement: sheet(ANDALUSIAN, 'flamenco', 'basic', 4, { palo: 'rumba', key: A_MINOR }) } };
export const FlamencoRumbaAdvanced: Story = { args: { arrangement: sheet(ANDALUSIAN, 'flamenco', 'advanced', 4, { palo: 'rumba', key: A_MINOR }) } };
export const FlamencoTangosModerate: Story = { args: { arrangement: sheet(ANDALUSIAN, 'flamenco', 'moderate', 4, { palo: 'tangos', key: A_MINOR }) } };
export const FlamencoTangosAdvanced: Story = { args: { arrangement: sheet(ANDALUSIAN, 'flamenco', 'advanced', 4, { palo: 'tangos', key: A_MINOR }) } };

/** 3/4 waltz. */
export const Waltz: Story = { args: { arrangement: sheet('D | G | A7 | D', 'arpeggio', 'moderate', 3) } };

/** Shapes as played, with the sounding chord in brackets. */
export const WithCapo: Story = { args: { arrangement: sheet('F# | D#m | B | C#', 'fingerstyle', 'moderate') } };

/** Narrow card: fewer bars per system. */
export const Narrow: Story = { args: { arrangement: sheet(POP, 'fingerstyle', 'moderate'), width: 360 } };

export const LanesHidden: Story = {
  args: { arrangement: sheet(POP, 'fingerstyle', 'advanced'), showFingers: false, showTechniques: false },
};

// Techniques: hand-built until flamenco patterns land in M7.
const EM = [0, 2, 2, 0, 0, 0];
const strum = (tick: number, tech: 'rasgueo-down' | 'rasgueo-up') =>
  EM.map((fret, string) => ({ tick, string, fret, tech, finger: 'i' as const }));

const TECHNIQUES: Record<string, Arrangement> = {
  hammerAndPull: techniqueSheet([
    { tick: 0, string: 0, fret: 0, finger: 'p' },
    { tick: 240, string: 3, fret: 0 },
    { tick: 480, string: 3, fret: 2, tech: 'hammer' },
    { tick: 960, string: 3, fret: 2 },
    { tick: 1200, string: 3, fret: 0, tech: 'pull' },
  ]),
  // M11: a thumb roll opening the bar, index brushes on 2 and 4 with a flick up after 4.
  slowStrums: techniqueSheet([
    ...EM.map((fret, string) => ({ tick: 0, string, fret, tech: 'brush-down' as const, finger: 'p' as const })),
    ...[3, 4, 5].map((string) => ({ tick: 480, string, fret: EM[string], tech: 'brush-down' as const, finger: 'i' as const })),
    { tick: 960, string: 0, fret: 0, finger: 'p' as const },
    ...[3, 4, 5].map((string) => ({ tick: 1440, string, fret: EM[string], tech: 'brush-down' as const, finger: 'i' as const })),
    ...[4, 5].map((string) => ({ tick: 1680, string, fret: EM[string], tech: 'brush-up' as const, finger: 'i' as const })),
  ]),
  rasgueado: techniqueSheet([...strum(0, 'rasgueo-down'), ...strum(480, 'rasgueo-up'), ...strum(960, 'rasgueo-down'), ...strum(1440, 'rasgueo-down')]),
  golpe: techniqueSheet([
    { tick: 0, string: 0, fret: 0, finger: 'p', accent: true },
    { tick: 480, string: 0, fret: -1, tech: 'golpe', finger: 'a' },
    { tick: 960, string: 0, fret: 0, finger: 'p', accent: true },
    { tick: 1440, string: 0, fret: -1, tech: 'golpe', finger: 'a' },
  ]),
  accents: techniqueSheet([0, 480, 960, 1440].map((tick, i) => ({ tick, string: 0, fret: 0, finger: 'p' as const, accent: i % 2 === 0 }))),
  apoyando: techniqueSheet([0, 240, 480, 720].map((tick, i) => ({ tick, string: 5 - (i % 2), fret: i % 2 ? 0 : 3, tech: 'apoyando' as const, finger: i % 2 ? ('m' as const) : ('i' as const) }))),
  tremolo: techniqueSheet([
    { tick: 0, string: 0, fret: 0, finger: 'p' },
    { tick: 0, string: 5, fret: 0, tech: 'tremolo', finger: 'a' },
    { tick: 960, string: 1, fret: 2, finger: 'p' },
    { tick: 960, string: 5, fret: 3, tech: 'tremolo', finger: 'a' },
  ]),
  slapAndPalmMute: techniqueSheet([0, 480, 960, 1440].flatMap((tick, i) => [
    { tick, string: 0, fret: 0, finger: 'p' as const, tech: 'palm-mute' as const },
    ...(i % 2 ? [{ tick, string: 0, fret: -1, finger: 'p' as const, tech: 'slap' as const }] : []),
    { tick: tick + 240, string: 4, fret: 0, finger: 'i' as const },
  ])),
  harmonicAndApagado: techniqueSheet([
    { tick: 0, string: 5, fret: 12, tech: 'harmonic', finger: 'a' },
    { tick: 0, string: 4, fret: 12, tech: 'harmonic', finger: 'm' },
    ...strum(960, 'rasgueo-down'),
    { tick: 1200, string: 0, fret: -1, tech: 'apagado', finger: 'p' },
  ]),
  pinch: techniqueSheet([0, 960].flatMap((tick) => [
    { tick, string: 0, fret: 0, finger: 'p' as const, tech: 'pinch' as const },
    { tick, string: 5, fret: 0, finger: 'a' as const, tech: 'pinch' as const },
  ])),
};

export const HammerOnAndPullOff: Story = { args: { arrangement: TECHNIQUES['hammerAndPull'] } };
export const Rasgueado: Story = { args: { arrangement: TECHNIQUES['rasgueado'] } };
export const SlowStrums: Story = { args: { arrangement: TECHNIQUES['slowStrums'] } };
export const Golpe: Story = { args: { arrangement: TECHNIQUES['golpe'] } };
export const Accents: Story = { args: { arrangement: TECHNIQUES['accents'] } };
export const Apoyando: Story = { args: { arrangement: TECHNIQUES['apoyando'] } };
export const Tremolo: Story = { args: { arrangement: TECHNIQUES['tremolo'] } };
export const Pinch: Story = { args: { arrangement: TECHNIQUES['pinch'] } };
export const SlapAndPalmMute: Story = { args: { arrangement: TECHNIQUES['slapAndPalmMute'] } };
export const HarmonicAndApagado: Story = { args: { arrangement: TECHNIQUES['harmonicAndApagado'] } };

function Timed({ arrangement, width }: { arrangement: Arrangement; width: number }) {
  const start = useRef(performance.now());
  const [ms, setMs] = useState<number | null>(null);
  useLayoutEffect(() => {
    setMs(performance.now() - start.current);
  }, []);
  return (
    <Card title={`200 bars${ms === null ? '' : ` · rendered in ${ms.toFixed(1)} ms`}`}>
      <p data-render-ms={ms ?? ''} style={{ margin: '0 0 var(--space-4)', color: 'var(--color-ink-2)' }}>
        Fingerstyle advanced, {arrangement.events.length} notes.
      </p>
      <TabSheet arrangement={arrangement} width={width} />
    </Card>
  );
}

const LONG = longSheet(200);

/** Done-when for M3: 200 bars render in under 50 ms. */
export const LongSong: Story = { render: () => <Timed arrangement={LONG} width={1040} /> };
