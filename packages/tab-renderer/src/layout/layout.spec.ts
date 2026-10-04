import { longSheet, sheet, techniqueSheet } from '../testing/fixtures';
import { GEOMETRY, layoutSheet } from './layout';

const G = GEOMETRY;

describe('layoutSheet', () => {
  const pop = sheet('G | D | Em | C | G | D | C | C');

  it('fits up to four bars per system on a wide sheet', () => {
    const l = layoutSheet(pop, 1200);
    expect(l.systems.map((s) => s.barCount)).toEqual([4, 4]);
    expect(l.systems[1].firstBar).toBe(4);
    expect(l.width).toBe(1200);
  });

  it('wraps to fewer bars as the sheet narrows', () => {
    const counts = [1200, 700, 420].map((w) => layoutSheet(pop, w).systems[0].barCount);
    expect(counts[0]).toBeGreaterThan(counts[1]);
    expect(counts[1]).toBeGreaterThanOrEqual(counts[2]);
    expect(counts[2]).toBeGreaterThanOrEqual(1);
  });

  it('never goes below one readable bar; the sheet scrolls instead', () => {
    const l = layoutSheet(pop, 120);
    expect(l.systems[0].barCount).toBe(1);
    expect(l.width).toBeGreaterThan(120);
    expect(l.colWidth).toBeGreaterThanOrEqual(G.minColWidth[240]);
  });

  it('uses eighth columns, or sixteenths when the pattern needs them', () => {
    expect(layoutSheet(pop, 1200).step).toBe(240);
    expect(layoutSheet(sheet('G | C', 'arpeggio', 'advanced'), 1200).step).toBe(120);
  });

  it('draws high e at the top and low E at the bottom', () => {
    const { stringY } = layoutSheet(pop, 1200).systems[0];
    expect(stringY[5]).toBeLessThan(stringY[0]);
    expect(stringY[0] - stringY[5]).toBe(5 * G.stringGap);
  });

  it('places every pitched event exactly once, left to right within a system', () => {
    const l = layoutSheet(pop, 1200);
    const notes = l.systems.flatMap((s) => s.notes);
    expect(notes.map((n) => n.eventIndex).sort((a, b) => a - b)).toEqual(pop.events.map((_, i) => i));
    for (const s of l.systems) {
      const byTick = s.notes.map((n) => [pop.events[n.eventIndex].tick, n.x] as const);
      for (const [t1, x1] of byTick) for (const [t2, x2] of byTick) if (t1 < t2) expect(x1).toBeLessThan(x2);
    }
  });

  it('marks thumb notes as bass', () => {
    const notes = layoutSheet(pop, 1200).systems[0].notes;
    const first = notes.find((n) => n.eventIndex === 0);
    expect(pop.events[0].finger).toBe('p');
    expect(first?.bass).toBe(true);
    expect(notes.filter((n) => !n.bass).every((n) => pop.events[n.eventIndex].finger !== 'p')).toBe(true);
  });

  it('labels chords at their tick, with the sounding name under a capo', () => {
    const capo = sheet('F# | D#m | B | C#', 'arpeggio', 'moderate');
    const [system] = layoutSheet(capo, 1200).systems;
    expect(system.chords.map((c) => [c.name, c.sounding])).toEqual([
      ['D', 'F#'],
      ['Bm', 'Ebm'],
      ['G', 'B'],
      ['A', 'C#'],
    ]);
    const plain = layoutSheet(pop, 1200).systems[0].chords[0];
    expect(plain.sounding).toBeUndefined();
  });

  it('lists the right-hand fingers per column, thumb first', () => {
    const t = techniqueSheet([
      { tick: 0, string: 0, fret: 0, finger: 'p', tech: 'pinch' },
      { tick: 0, string: 5, fret: 0, finger: 'a', tech: 'pinch' },
      { tick: 240, string: 3, fret: 0, finger: 'i' },
    ]);
    const { fingers } = layoutSheet(t, 1200).systems[0];
    expect(fingers.map((f) => f.text)).toEqual(['pa', 'i']);
  });

  it('gives every event a playhead position', () => {
    const l = layoutSheet(pop, 700);
    expect(l.positions).toHaveLength(pop.events.length);
    const last = l.positions[l.positions.length - 1];
    expect(last.system).toBe(l.systems.length - 1);
  });

  it('stacks systems vertically', () => {
    const l = layoutSheet(pop, 1200);
    expect(l.systems[1].y).toBe(G.systemHeight + G.systemGap);
    expect(l.height).toBe(2 * G.systemHeight + G.systemGap);
  });

  it('handles an empty arrangement', () => {
    const empty = { ...pop, bars: 0, events: [], chordMarks: [] };
    expect(layoutSheet(empty, 800)).toMatchObject({ systems: [], positions: [], height: 0 });
  });

  describe('techniques', () => {
    const kinds = (t: ReturnType<typeof techniqueSheet>) => layoutSheet(t, 1200).systems[0].techniques;

    it('draws a slur from the previous note on the string for hammer-ons and pull-offs', () => {
      const t = techniqueSheet([
        { tick: 0, string: 3, fret: 0 },
        { tick: 240, string: 3, fret: 2, tech: 'hammer' },
        { tick: 480, string: 3, fret: 0, tech: 'pull' },
      ]);
      const slurs = kinds(t).filter((m) => m.kind === 'slur');
      expect(slurs.map((s) => s.kind === 'slur' && s.label)).toEqual(['h', 'p']);
      const notes = layoutSheet(t, 1200).systems[0].notes;
      const [s0] = slurs;
      expect(s0.kind === 'slur' && [s0.x1, s0.x2]).toEqual([notes[0].x, notes[1].x]);
    });

    it('starts a slur at the system edge when the first note is on the previous line', () => {
      const t = techniqueSheet(
        [
          { tick: 1920 - 240, string: 3, fret: 0 },
          { tick: 1920, string: 3, fret: 2, tech: 'hammer' },
        ],
        2,
      );
      const l = layoutSheet(t, 300);
      expect(l.systems).toHaveLength(2);
      const slur = l.systems[1].techniques.find((m) => m.kind === 'slur');
      expect(slur?.kind === 'slur' && slur.x1).toBe(G.left);
    });

    it('marks accents once per column', () => {
      const t = techniqueSheet([
        { tick: 0, string: 0, fret: 0, accent: true },
        { tick: 0, string: 5, fret: 0, accent: true },
      ]);
      expect(kinds(t).filter((m) => m.kind === 'accent')).toHaveLength(1);
    });

    it('draws one rasgueado arrow across the strummed strings', () => {
      const t = techniqueSheet([0, 1, 2, 3, 4, 5].map((s) => ({ tick: 0, string: s, fret: [0, 2, 2, 0, 0, 0][s], tech: 'rasgueo-down' as const })));
      const arrows = kinds(t).filter((m) => m.kind === 'rasgueo');
      expect(arrows).toHaveLength(1);
      const [a] = arrows;
      const { stringY } = layoutSheet(t, 1200).systems[0];
      expect(a.kind === 'rasgueo' && [a.direction, a.y1, a.y2]).toEqual(['down', stringY[5], stringY[0]]);
    });

    it('shows golpe in the technique lane and not as a fret number', () => {
      const t = techniqueSheet([{ tick: 0, string: 0, fret: -1, tech: 'golpe', finger: 'a' }]);
      const sys = layoutSheet(t, 1200).systems[0];
      expect(sys.notes).toHaveLength(0);
      expect(sys.techniques.map((m) => m.kind)).toEqual(['golpe']);
    });

    it('links pinched notes and marks apoyando and tremolo', () => {
      const t = techniqueSheet([
        { tick: 0, string: 0, fret: 0, finger: 'p', tech: 'pinch' },
        { tick: 0, string: 5, fret: 0, finger: 'a', tech: 'pinch' },
        { tick: 480, string: 4, fret: 0, tech: 'apoyando' },
        { tick: 960, string: 5, fret: 0, tech: 'tremolo', finger: 'a' },
      ]);
      expect(kinds(t).map((m) => m.kind).sort()).toEqual(['apoyando', 'pinch', 'tremolo']);
    });
  });

  it('lays out 200 bars in well under 50 ms', () => {
    const long = longSheet(200);
    layoutSheet(long, 1200);
    const t0 = performance.now();
    const l = layoutSheet(long, 1200);
    const ms = performance.now() - t0;
    expect(l.systems).toHaveLength(50);
    expect(ms).toBeLessThan(25);
  });
});
