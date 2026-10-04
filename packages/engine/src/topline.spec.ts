import { arrange } from './arrange.js';
import { chordTones, parseChord } from './chords.js';
import { LEVELS } from './patterns/index.js';
import { PROGRESSIONS, progression } from './testing/progression.js';
import type { Arrangement, Level, NoteEvent, Style } from './types.js';

const OPEN_MIDI = [40, 45, 50, 55, 59, 64];
const pcOf = (a: Arrangement, e: NoteEvent) => (OPEN_MIDI[e.string] + e.fret + a.capo) % 12;

/** Plucked notes on the shape's top string, per chord mark. */
function topNotes(a: Arrangement) {
  return a.chordMarks.map((m, i) => {
    const end = a.chordMarks[i + 1]?.tick ?? Infinity;
    const top = Math.max(...m.voicing.frets.map((f, s) => (f >= 0 ? s : -1)));
    return {
      mark: m,
      top,
      // Harmonics sit at a node (fret 12 or 7), outside the shape, and the top line leaves them alone.
      notes: a.events.filter((e) => e.tick >= m.tick && e.tick < end && e.string === top && e.finger !== 'p' && e.fret >= 0 && e.tech !== 'harmonic'),
    };
  });
}

const PLUCKED: Array<[Style, Level]> = (['arpeggio', 'fingerstyle'] as const).flatMap((s) => LEVELS.map((l) => [s, l] as [Style, Level]));

describe('moving top line', () => {
  it('leaves Basic sheets on the shape’s own top note', () => {
    for (const style of ['arpeggio', 'fingerstyle'] as const) {
      const a = arrange(progression('C | G | Am | F'), { style, level: 'basic' });
      for (const { mark, top, notes } of topNotes(a)) for (const n of notes) expect(n.fret).toBe(mark.voicing.frets[top]);
    }
  });

  it('alternates between a chord tone and a neighbour within a chord', () => {
    const a = arrange(progression('C | C'), { style: 'fingerstyle', level: 'moderate' });
    const frets = topNotes(a)[0].notes.map((n) => n.fret);
    expect(new Set(frets).size).toBe(2);
    frets.forEach((f, i) => expect(f).toBe(frets[i % 2]));
  });

  it('starts each chord near where the line was', () => {
    // C ends its bar on G (3rd fret); Em's nearest chord tone is G too, not the open E.
    const a = arrange(progression('C | Em'), { style: 'arpeggio', level: 'moderate' });
    const [c, em] = topNotes(a);
    const lastOfC = OPEN_MIDI[c.top] + c.notes[c.notes.length - 1].fret;
    const firstOfEm = OPEN_MIDI[em.top] + em.notes[0].fret;
    expect(Math.abs(firstOfEm - lastOfC)).toBeLessThanOrEqual(2);
  });

  describe.each(PROGRESSIONS.map((p) => [p.name, p]))('%s', (_name, p) => {
    it.each(PLUCKED)('%s %s: plays chord tones on the beat and keeps every note in reach', (style, level) => {
      const a = arrange(progression(p.chart, p.beatsPerBar), { style, level });
      for (const { mark, top, notes } of topNotes(a)) {
        const parsed = parseChord(mark.soundingName);
        if (!parsed) throw new Error(`Unparsable chord ${mark.soundingName}`);
        const tones = chordTones(parsed.label);
        // The first top note of each chord is a chord tone.
        if (notes.length) expect(tones.has(pcOf(a, notes[0]))).toBe(true);
        for (const n of notes) {
          const fretted = mark.voicing.frets.filter((f, s) => s !== top && f > 0);
          if (n.fret > 0) expect(Math.max(...fretted, n.fret) - Math.min(...fretted, n.fret)).toBeLessThanOrEqual(3);
        }
      }
    });
  });

  it('leaves hammer-ons and pull-offs alone', () => {
    const plain = arrange(progression('C | G | Am | F'), { style: 'fingerstyle', level: 'advanced', patternId: 'fingerstyle.advanced.travis-hammer' });
    for (const { notes } of topNotes(plain)) {
      if (notes.some((n) => n.tech === 'hammer' || n.tech === 'pull')) expect(new Set(notes.map((n) => n.fret)).size).toBeLessThanOrEqual(2);
    }
  });
});
