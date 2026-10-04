import { TICKS_PER_BEAT } from '../constants.js';
import type { Arrangement, NoteEvent } from '../types.js';

const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];
const CELL = 4;
const BARS_PER_LINE = 2;

const cell = (text: string, fill: string) => (text + fill.repeat(CELL)).slice(0, CELL);

function noteText(n: NoteEvent): string {
  const fret = n.fret < 0 ? 'x' : String(n.fret);
  if (n.tech === 'hammer') return `h${fret}`;
  if (n.tech === 'pull') return `p${fret}`;
  return fret;
}

/**
 * Test helper: a plain-text tab for reviewing snapshots. One column per
 * eighth (or sixteenth when needed), strings high e on top, then the
 * right-hand fingers and any warnings.
 */
export function asciiTab(a: Arrangement): string {
  const step = a.events.every((e) => e.tick % (TICKS_PER_BEAT / 2) === 0)
    ? TICKS_PER_BEAT / 2
    : TICKS_PER_BEAT / 4;
  const barTicks = a.meter.beatsPerBar * TICKS_PER_BEAT;
  const cols = barTicks / step;
  const lines = [`${a.patternId} | capo ${a.capo} | ${a.meter.beatsPerBar}/4 | ${a.bpm} bpm`];

  for (let first = 0; first < a.bars; first += BARS_PER_LINE) {
    const barRange = Array.from({ length: Math.min(BARS_PER_LINE, a.bars - first) }, (_, i) => first + i);
    let chords = '   ';
    let fingers = '   ';
    const rows = STRING_NAMES.map((name) => `${name} |`);
    for (const bar of barRange) {
      for (let c = 0; c < cols; c++) {
        const tick = bar * barTicks + c * step;
        const mark = a.chordMarks.find((m) => m.tick === tick);
        chords += cell(mark ? mark.voicing.name : '', ' ');
        const here = a.events.filter((e) => e.tick === tick);
        fingers += cell(here.map((e) => e.finger).join(''), ' ');
        for (let s = 0; s < 6; s++) {
          const n = here.find((e) => e.string === s);
          rows[s] += cell(n ? noteText(n) : '', '-');
        }
      }
      chords += ' ';
      fingers += ' ';
      for (let s = 0; s < 6; s++) rows[s] += '|';
    }
    lines.push('', chords.trimEnd(), ...rows.reverse(), fingers.trimEnd());
  }
  if (a.warnings.length) lines.push('', ...a.warnings.map((w) => `! ${w.code}: ${w.message}`));
  return lines.join('\n');
}
