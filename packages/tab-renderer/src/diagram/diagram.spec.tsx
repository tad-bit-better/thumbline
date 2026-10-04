import { render, screen } from '@testing-library/react';
import type { Voicing } from '@thumbline/engine';
import { axeViolations } from '../testing/axe';
import { sheet, techniqueSheet } from '../testing/fixtures';
import { ChordDiagram } from './ChordDiagram';
import { ChordShapes } from './ChordShapes';
import { TabLegend } from './TabLegend';

const C: Voicing = { name: 'C', frets: [-1, 3, 2, 0, 1, 0], rootString: 1, barre: false };
const F: Voicing = { name: 'F', frets: [1, 3, 3, 2, 1, 1], rootString: 0, barre: true };
const Bb: Voicing = { name: 'Bb', frets: [-1, 6, 8, 8, 8, 6], rootString: 1, barre: true };

describe('ChordDiagram', () => {
  it('reads the shape aloud from low to high', () => {
    render(<ChordDiagram voicing={C} />);
    expect(screen.getByRole('img', { name: 'C chord shape, low to high: x 3 2 0 1 0' })).toBeTruthy();
  });

  it('marks muted and open strings and fretted dots', () => {
    const { container } = render(<ChordDiagram voicing={C} />);
    expect(container.querySelectorAll('[data-muted]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-open]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-dot]')).toHaveLength(3);
    expect(container.querySelector('[data-root]')?.getAttribute('data-string')).toBe('1');
  });

  it('draws the nut in open position', () => {
    const { container } = render(<ChordDiagram voicing={C} />);
    expect(container.querySelector('[data-nut]')).toBeTruthy();
    expect(container.querySelector('[data-base-fret]')).toBeNull();
  });

  it('draws one bar for a barre instead of separate dots', () => {
    const { container } = render(<ChordDiagram voicing={F} />);
    expect(container.querySelectorAll('[data-barre]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-dot]')).toHaveLength(3);
  });

  it('labels the base fret for shapes up the neck', () => {
    const { container } = render(<ChordDiagram voicing={Bb} />);
    expect(container.querySelector('[data-nut]')).toBeNull();
    expect(container.querySelector('[data-base-fret]')?.textContent).toBe('6fr');
  });

  it('says which chord a Basic substitute stands in for', () => {
    render(<ChordDiagram voicing={{ name: 'Fmaj7', frets: [-1, -1, 3, 2, 1, 0], rootString: 2, barre: false, simplified: { from: 'F' } }} />);
    expect(screen.getByText('for F')).toBeTruthy();
  });

  it('has no axe violations', async () => {
    const { container } = render(<ChordDiagram voicing={F} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('ChordShapes', () => {
  it('lists each shape once, in order of appearance', () => {
    render(<ChordShapes arrangement={sheet('G | D | Em | C | G | D | C | C')} />);
    expect(screen.getByRole('list', { name: 'Chord shapes' })).toBeTruthy();
    expect(screen.getAllByRole('img').map((i) => i.getAttribute('aria-label')?.split(' ')[0])).toEqual(['G', 'D', 'Em', 'C']);
  });
});

describe('TabLegend', () => {
  it('always explains the fingers and bass notes', () => {
    render(<TabLegend arrangement={sheet('G | C')} />);
    expect(screen.getByText(/bass note, played with the thumb/i)).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Legend' }).textContent).toContain('p thumb · i index · m middle · a ring · c little');
  });

  it('only explains techniques that appear', () => {
    const plain = render(<TabLegend arrangement={sheet('G | C')} />);
    expect(plain.queryByText(/golpe/i)).toBeNull();
    plain.unmount();
    render(
      <TabLegend
        arrangement={techniqueSheet([
          { tick: 0, string: 0, fret: -1, tech: 'golpe' },
          { tick: 240, string: 3, fret: 0 },
          { tick: 480, string: 3, fret: 2, tech: 'hammer' },
        ])}
      />,
    );
    expect(screen.getByText(/golpe/i)).toBeTruthy();
    expect(screen.getByText(/hammer-on/i)).toBeTruthy();
    expect(screen.queryByText(/rasgueado/i)).toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = render(<TabLegend arrangement={sheet('G | C', 'fingerstyle', 'advanced')} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
