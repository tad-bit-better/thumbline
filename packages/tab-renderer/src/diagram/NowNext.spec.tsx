import { render, screen, within } from '@testing-library/react';
import { axeViolations } from '../testing/axe';
import { sheet } from '../testing/fixtures';
import { ChordShapes } from './ChordShapes';
import { NowNext, nowAndNext } from './NowNext';

const pop = sheet('G | G | D | Em | C', 'arpeggio', 'moderate');
const BAR = 4 * 480;

describe('nowAndNext', () => {
  it('finds the chord under the playhead and the next different one', () => {
    expect(nowAndNext(pop, 0)).toMatchObject({ now: { voicing: { name: 'G' } }, next: { voicing: { name: 'D' } } });
    expect(nowAndNext(pop, BAR + 10)).toMatchObject({ now: { voicing: { name: 'G' } }, next: { voicing: { name: 'D' } } });
    expect(nowAndNext(pop, 3 * BAR)).toMatchObject({ now: { voicing: { name: 'Em' } }, next: { voicing: { name: 'C' } } });
  });

  it('has nothing next at the last chord', () => {
    expect(nowAndNext(pop, 4 * BAR + 100).next).toBeUndefined();
  });
});

describe('NowNext', () => {
  it('shows both diagrams, now first, named for screen readers', () => {
    render(<NowNext arrangement={pop} tick={2 * BAR} />);
    const list = screen.getByRole('list', { name: 'Now and next chords' });
    const items = within(list).getAllByRole('listitem');
    expect(items.map((i) => i.getAttribute('aria-label'))).toEqual(['Now: D', 'Next: Em']);
  });

  it('says what a shape sounds like under a capo', () => {
    const capo = sheet('F# | D#m', 'arpeggio', 'moderate');
    render(<NowNext arrangement={capo} tick={0} />);
    expect(screen.getByText('sounds F#')).toBeTruthy();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<NowNext arrangement={pop} tick={0} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('ChordShapes as a list', () => {
  it('lists each shape once with what it sounds like and its badges', () => {
    const capo = sheet('F# | D#m | F# | B', 'arpeggio', 'moderate');
    const { container } = render(<ChordShapes arrangement={capo} variant="list" />);
    const rows = container.querySelectorAll('li');
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain('sounds F#');
    const barres = capo.chordMarks.filter((m, i, all) => all.findIndex((x) => x.voicing.name === m.voicing.name) === i && m.voicing.barre).length;
    expect(screen.queryAllByText('Barre')).toHaveLength(barres);
  });
});
