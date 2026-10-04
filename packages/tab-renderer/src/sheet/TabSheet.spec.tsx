import { fireEvent, render, screen } from '@testing-library/react';
import { layoutSheet } from '../layout/layout';
import { axeViolations } from '../testing/axe';
import { sheet, techniqueSheet } from '../testing/fixtures';
import { TabSheet } from './TabSheet';

const pop = sheet('G | D | Em | C | G | D | C | C');

describe('TabSheet', () => {
  it('reports the tick under a click, scaled to the drawn size', () => {
    const onSeek = vi.fn();
    render(<TabSheet arrangement={pop} width={1200} onSeek={onSeek} />);
    const [, second] = screen.getAllByRole('img');
    const l = layoutSheet(pop, 1200);
    // Drawn at half size: a click at 50 px is layout x 100, inside bar 5 (the second system's first bar).
    second.getBoundingClientRect = () => ({ left: 0, top: 0, width: l.width / 2, height: 81, right: l.width / 2, bottom: 81, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.click(second, { clientX: 50 });
    const tick = onSeek.mock.calls[0][0] as number;
    expect(Math.floor(tick / l.barTicks)).toBe(4);
  });

  it('is not clickable without onSeek', () => {
    const { container } = render(<TabSheet arrangement={pop} width={1200} />);
    expect(container.querySelector('[data-seekable]')).toBeNull();
  });

  it('draws one labelled image per system', () => {
    render(<TabSheet arrangement={pop} width={1200} />);
    const systems = screen.getAllByRole('img');
    expect(systems).toHaveLength(2);
    expect(systems[0].getAttribute('aria-label')).toBe('Bars 1–4: G, D, Em, C');
    expect(systems[1].getAttribute('aria-label')).toBe('Bars 5–8: G, D, C, C');
  });

  it('is a focusable, labelled region so it can be scrolled by keyboard', () => {
    render(<TabSheet arrangement={pop} width={1200} label="Fingerstyle tab" />);
    const region = screen.getByRole('region', { name: 'Fingerstyle tab' });
    expect(region.getAttribute('tabindex')).toBe('0');
  });

  it('labels a one-bar system without a range', () => {
    render(<TabSheet arrangement={sheet('G')} width={1200} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Bar 1: G');
  });

  it('sizes each system to the layout width', () => {
    const { container } = render(<TabSheet arrangement={pop} width={300} />);
    const { width } = layoutSheet(pop, 300);
    expect(container.querySelector('svg')?.getAttribute('width')).toBe(String(width));
  });

  it('draws a fret number for every pitched note, thumb notes on a bass chip', () => {
    const { container } = render(<TabSheet arrangement={pop} width={1200} />);
    const notes = container.querySelectorAll('[data-note]');
    expect(notes).toHaveLength(pop.events.length);
    const bass = container.querySelectorAll('[data-note][data-bass]');
    expect(bass).toHaveLength(pop.events.filter((e) => e.finger === 'p').length);
  });

  it('shows the sounding chord next to the shape under a capo', () => {
    const { container } = render(<TabSheet arrangement={sheet('F# | B', 'arpeggio', 'moderate')} width={1200} />);
    expect(container.querySelector('[data-chord]')?.textContent).toBe('E(F#)');
  });

  it('can hide the finger and technique lanes', () => {
    const t = techniqueSheet([{ tick: 0, string: 0, fret: 0, accent: true, finger: 'p' }]);
    const { container, rerender } = render(<TabSheet arrangement={t} width={1200} />);
    expect(container.querySelector('[data-finger]')).toBeTruthy();
    expect(container.querySelector('[data-tech]')).toBeTruthy();
    rerender(<TabSheet arrangement={t} width={1200} showFingers={false} showTechniques={false} />);
    expect(container.querySelector('[data-finger]')).toBeNull();
    expect(container.querySelector('[data-tech]')).toBeNull();
  });

  it('draws every technique symbol', () => {
    const t = techniqueSheet([
      { tick: 0, string: 3, fret: 0 },
      { tick: 240, string: 3, fret: 2, tech: 'hammer' },
      { tick: 480, string: 3, fret: 0, tech: 'pull', accent: true },
      { tick: 720, string: 4, fret: 0, tech: 'apoyando' },
      ...[0, 1, 2, 3, 4, 5].map((s) => ({ tick: 960, string: s, fret: [0, 2, 2, 0, 0, 0][s], tech: 'rasgueo-down' as const })),
      ...[0, 1, 2, 3, 4, 5].map((s) => ({ tick: 1200, string: s, fret: [0, 2, 2, 0, 0, 0][s], tech: 'rasgueo-up' as const })),
      { tick: 1440, string: 0, fret: -1, tech: 'golpe' },
      { tick: 1680, string: 0, fret: 0, tech: 'pinch', finger: 'p' },
      { tick: 1680, string: 5, fret: 0, tech: 'pinch', finger: 'a' },
    ]);
    const { container } = render(<TabSheet arrangement={t} width={1200} />);
    const kinds = [...container.querySelectorAll('[data-tech]')].map((el) => el.getAttribute('data-tech'));
    expect(new Set(kinds)).toEqual(new Set(['slur', 'accent', 'apoyando', 'rasgueo', 'golpe', 'pinch']));
    expect(container.querySelector('[data-tech="rasgueo"][data-direction="up"]')).toBeTruthy();
  });

  it('draws tremolo marks', () => {
    const t = techniqueSheet([{ tick: 0, string: 5, fret: 0, tech: 'tremolo', finger: 'a' }]);
    const { container } = render(<TabSheet arrangement={t} width={1200} />);
    expect(container.querySelector('[data-tech="tremolo"]')).toBeTruthy();
  });

  it('renders nothing for an empty arrangement', () => {
    const { container } = render(<TabSheet arrangement={{ ...pop, bars: 0, events: [], chordMarks: [] }} width={800} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = render(<TabSheet arrangement={pop} width={1200} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
