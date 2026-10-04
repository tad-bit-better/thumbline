import type { Meta, StoryObj } from '@storybook/react-vite';
import type { Voicing } from '@thumbline/engine';
import { sheet, techniqueSheet } from '../testing/fixtures';
import { ChordDiagram } from './ChordDiagram';
import { ChordShapes } from './ChordShapes';
import { TabLegend } from './TabLegend';

const meta: Meta = { title: 'Tab/Chord diagrams and legend' };
export default meta;

const VOICINGS: Voicing[] = [
  { name: 'C', frets: [-1, 3, 2, 0, 1, 0], rootString: 1, barre: false },
  { name: 'G', frets: [3, 2, 0, 0, 0, 3], rootString: 0, barre: false },
  { name: 'D', frets: [-1, -1, 0, 2, 3, 2], rootString: 2, barre: false },
  { name: 'F', frets: [1, 3, 3, 2, 1, 1], rootString: 0, barre: true },
  { name: 'Bm', frets: [-1, 2, 4, 4, 3, 2], rootString: 1, barre: true },
  { name: 'Bb', frets: [-1, 6, 8, 8, 8, 6], rootString: 1, barre: true },
  { name: 'Fmaj7', frets: [-1, -1, 3, 2, 1, 0], rootString: 2, barre: false, simplified: { from: 'F' } },
];

const row = { display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap', alignItems: 'end' } as const;

/** Open shapes, barre chords, a shape up the neck and a Basic substitute. */
export const Diagrams: StoryObj = {
  render: () => (
    <div style={row}>
      {VOICINGS.map((v) => (
        <ChordDiagram key={v.name} voicing={v} size={96} />
      ))}
    </div>
  ),
};

/** The shapes row on the Sheet screen. */
export const ShapesForASong: StoryObj = {
  render: () => <ChordShapes arrangement={sheet('C | G/B | Am | F | C | G | Dm7 | G', 'arpeggio', 'basic')} />,
};

/** Only the symbols this sheet uses are explained. */
export const LegendFingerstyle: StoryObj = {
  render: () => <TabLegend arrangement={sheet('G | D | Em | C', 'fingerstyle', 'advanced')} />,
};

export const LegendAllTechniques: StoryObj = {
  render: () => (
    <TabLegend
      arrangement={techniqueSheet([
        { tick: 0, string: 0, fret: 0, finger: 'p', accent: true, tech: 'pinch' },
        { tick: 0, string: 5, fret: 0, finger: 'a', tech: 'pinch' },
        { tick: 240, string: 3, fret: 2, tech: 'hammer' },
        { tick: 480, string: 0, fret: -1, tech: 'golpe' },
        { tick: 720, string: 4, fret: 0, tech: 'apoyando' },
        { tick: 960, string: 5, fret: 0, tech: 'tremolo' },
        { tick: 1200, string: 2, fret: 2, tech: 'rasgueo-down' },
      ])}
    />
  ),
};
