import { fireEvent, render, screen, within } from '@testing-library/react';
import { axeViolations } from '../testing/axe';
import { sheet } from '../testing/fixtures';
import { TabSheet } from './TabSheet';

const pop = sheet('G | D | Em | C | G | D | C | C');
const SECTIONS = [
  { id: 'a', title: 'Section A', detail: 'Bars 1–4', firstBar: 0, bars: 4 },
  { id: 'b', title: 'Section B', detail: 'Bars 5–8', firstBar: 4, bars: 4 },
];

describe('TabSheet bar cards', () => {
  it('draws one card per bar under its section heading', () => {
    render(<TabSheet arrangement={pop} width={900} variant="cards" sections={SECTIONS} />);
    const groups = screen.getAllByRole('group');
    expect(groups.map((g) => within(g).getByRole('heading').textContent)).toEqual(['Section ABars 1–4', 'Section BBars 5–8']);
    expect(within(groups[0]).getAllByRole('img')).toHaveLength(4);
    expect(within(groups[1]).getAllByRole('img')).toHaveLength(4);
  });

  it('heads each card with its bar number and chord', () => {
    const { container } = render(<TabSheet arrangement={pop} width={900} variant="cards" />);
    const first = container.querySelector('[data-bar-card="0"]') as HTMLElement;
    expect(first.querySelector('[data-bar-number]')?.textContent).toBe('1');
    expect(first.querySelector('[data-card-chord]')?.textContent).toContain('G');
  });

  it('puts the app\'s controls beside each section heading, outside the heading', () => {
    render(
      <TabSheet
        arrangement={pop}
        width={900}
        variant="cards"
        sections={SECTIONS}
        renderSectionActions={(sec) => <button type="button">Edit {sec.title}</button>}
      />,
    );
    expect(screen.getByRole('button', { name: 'Edit Section B' })).toBeTruthy();
    expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual(['Section ABars 1–4', 'Section BBars 5–8']);
  });

  it('lets the app wrap a card\'s chords (a button to change them)', () => {
    render(
      <TabSheet
        arrangement={pop}
        width={900}
        variant="cards"
        renderChords={(bar, chords) => (
          <button type="button" aria-label={`Change bar ${bar + 1}`}>
            {chords}
          </button>
        )}
      />,
    );
    expect(screen.getByRole('button', { name: 'Change bar 3' }).textContent).toContain('Em');
  });

  it('shows what a shape sounds like under a capo, per the chord-name setting', () => {
    const capo = sheet('F# | D#m | B | C#', 'arpeggio', 'moderate');
    const shapeName = capo.chordMarks[0].voicing.name;
    expect(capo.capo).toBeGreaterThan(0);
    const both = render(<TabSheet arrangement={capo} width={900} variant="cards" chordNames="both" />);
    expect(both.container.querySelector('[data-bar-card="0"] [data-card-chord]')?.textContent).toBe(`${shapeName} sounds F#`);
    both.unmount();
    const sounding = render(<TabSheet arrangement={capo} width={900} variant="cards" chordNames="sounding" />);
    expect(sounding.container.querySelector('[data-bar-card="0"] [data-card-chord]')?.textContent).toBe('F#');
    sounding.unmount();
    const shape = render(<TabSheet arrangement={capo} width={900} variant="cards" chordNames="shape" />);
    expect(shape.container.querySelector('[data-bar-card="0"] [data-card-chord]')?.textContent).toBe(shapeName);
  });

  it('badges a barre shape', () => {
    const barre = sheet('F | C', 'arpeggio', 'moderate');
    const { container } = render(<TabSheet arrangement={barre} width={900} variant="cards" />);
    const f = container.querySelector('[data-bar-card="0"]') as HTMLElement;
    if (barre.chordMarks[0].voicing.barre) expect(within(f).getByText('Barre')).toBeTruthy();
    else expect(within(f).queryByText('Barre')).toBeNull();
  });

  it('marks the playing bar and draws the playhead in it', () => {
    const index = pop.events.findIndex((e) => e.tick >= 2 * pop.meter.beatsPerBar * 480);
    const { container } = render(<TabSheet arrangement={pop} width={900} variant="cards" cursorIndex={index} />);
    const active = container.querySelectorAll('[data-bar-card][data-active]');
    expect(active).toHaveLength(1);
    expect(active[0].getAttribute('data-bar-card')).toBe('2');
    expect(active[0].querySelector('[data-playhead]')).toBeTruthy();
  });

  it('puts more cards on a row at a smaller tab size', () => {
    const cols = (size: 's' | 'm' | 'l') => {
      const { container, unmount } = render(<TabSheet arrangement={pop} width={1000} variant="cards" size={size} />);
      const n = Number((container.querySelector('[data-cards]') as HTMLElement).style.getPropertyValue('--cols'));
      unmount();
      return n;
    };
    expect(cols('s')).toBeGreaterThan(cols('m'));
    expect(cols('m')).toBeGreaterThan(cols('l'));
  });

  it('seeks from a click on a card', () => {
    const onSeek = vi.fn();
    render(<TabSheet arrangement={pop} width={900} variant="cards" onSeek={onSeek} />);
    const third = screen.getAllByRole('img')[2];
    third.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.click(third, { clientX: 100 });
    expect(Math.floor((onSeek.mock.calls[0][0] as number) / (pop.meter.beatsPerBar * 480))).toBe(2);
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<TabSheet arrangement={pop} width={900} variant="cards" sections={SECTIONS} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
