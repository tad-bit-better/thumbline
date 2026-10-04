# Engine spec

Contracts between packages. Change these only together with the code that uses them.

## Conventions
- **Strings:** index 0 = low E (6th string) … 5 = high e (1st string).
- **Frets:** relative to the capo. `-1` = muted, `0` = open (or at the capo).
- **Pitch class (`pc`):** 0–11, C = 0.
- **Time:** ticks, 480 per beat. A 4/4 bar = 1920 ticks.
- **MIDI pitch** of a note = `OPEN_MIDI[string] + capo + fret`, with `OPEN_MIDI = [40, 45, 50, 55, 59, 64]`.

## 1. AnalysisResult (audio-analysis → engine)

```ts
type Quality = 'maj'|'m'|'7'|'m7'|'maj7'|'sus2'|'sus4'|'dim'|'add9'|'6';

type ChordLabel = { pc: number; quality: Quality; bassPc?: number }; // bassPc for slash chords

type ChordSegment = {
  bar: number;            // 0-based
  beat: number;           // 0-based beat within the bar where the chord starts
  chord: ChordLabel | null;   // null = no chord / silence
  confidence: number;     // 0..1
  alternatives: ChordLabel[]; // up to 3, best first
};

type AnalysisResult = {
  version: 1;
  durationSec: number;
  bpm: number;
  beatTimesSec: number[];      // every detected beat, for audio sync
  barStartBeat: number;        // index into beatTimesSec of bar 0's downbeat
  meter: { beatsPerBar: 3 | 4 | 12; accents?: number[] }; // accents used from v1.5
  key: { pc: number; mode: 'major' | 'minor' | 'phrygian' };
  chords: ChordSegment[];      // sorted by (bar, beat)
};
```

The review screen edits `chords[].chord` and `meter.beatsPerBar`. Nothing else is user-editable in v1.

## 2. Pattern DSL (data in engine/src/patterns)

```ts
type Style = 'arpeggio' | 'fingerstyle' | 'flamenco';
type Level = 'basic' | 'moderate' | 'advanced';
type Finger = 'p' | 'i' | 'm' | 'a' | 'c';

// What string an event targets, resolved against the current voicing
type Target =
  | 'bass'      // root string of the voicing
  | 'altBass'   // alternate bass (see §4)
  | 't1' | 't2' | 't3'   // highest three sounded strings: t1 = 1st string
  | 't4'        // 4th string when it isn't the bass
  | 'scale'     // next note of a scale run (picado), resolved by the scale walker
  | 'all';      // all sounded strings (rasgueado, plucked chord)

type Technique =
  | 'tirando' | 'apoyando'          // free stroke / rest stroke
  | 'rasgueo-down' | 'rasgueo-up'   // flamenco rasgueado strokes
  | 'golpe'                         // tap on the top, no pitch
  | 'tremolo'                       // repeated note p-a-m-i
  | 'hammer' | 'pull'               // left-hand legato from the previous note on that string
  | 'pinch';                        // simultaneous thumb + finger

type PatternEvent = {
  tick: number;           // start, relative to the start of the chord segment or bar (see anchor)
  dur: number;            // ticks
  finger: Finger;
  target: Target;
  tech?: Technique;
  accent?: boolean;
  velocity?: number;      // 0..1, default 0.8
};

type PatternDef = {
  id: string;             // 'arpeggio.moderate.pami'
  name: string;           // user-facing
  hint: string;           // one-sentence how-to shown under the name
  style: Style;
  level: Level;
  meters: Array<3 | 4 | 12>;       // which meters this pattern supports
  anchor: 'bar' | 'chord';         // restart the pattern at each bar or at each chord change
  events: Partial<Record<3 | 4 | 12, PatternEvent[]>>; // one list per meter in `meters`
  requires?: { openTreble?: boolean; maxFret?: number }; // when the pattern can be used
  palos?: Array<'rumba' | 'tangos' | 'solea' | 'bulerias' | 'alegrias'>; // flamenco only
};
```

**Rules the pattern runner applies (not the pattern):**
- When a chord changes on a tick with no `bass` event, insert a `bass` event (finger `p`) at that tick and drop any `altBass` there.
- Events whose target string is muted in the voicing are dropped.
- Two events on the same string at the same tick: keep the first.
- `hammer`/`pull` need a previous note on the same string within one beat; otherwise the runner substitutes a normal stroke.
- A `golpe` event becomes one pitchless note (string 0, fret -1, tech `golpe`) whatever its target, and doesn't take a string's slot, so it can land with a strum on the same tick.
- A `scale` target takes the next note from the scale walker (§4), one per event.
- Flamenco patterns list their `palos`; `arrange` keeps to the requested palo (default `rumba`; v1 plays `rumba` and `tangos`, others throw), including when it falls back a level.

**Moving top line (after the runner, Moderate and Advanced only):** plucked notes on the shape's top string (the `t1` string) may change fret, so the line moves instead of repeating one note. Within each chord, notes alternate between a chord tone and a neighbour, starting with the chord tone nearest the previous chord's last top note. The neighbour is the next chord tone up within 5 semitones; else a note of the song's key 2–3 semitones up; else the same downwards. Every fret stays within reach of the shape (fretted notes at most 3 frets apart, at most 4 fingers, no open string under a barre). Thumb notes, strums, golpes and chords with a hammer-on or pull-off on that string are left alone. Basic sheets keep the shape's own top note. `chordMarks[].voicing` still shows the base shape.

## 3. Arrangement (engine → renderer, playback)

```ts
type Voicing = {
  name: string;           // shape name as played, e.g. 'Em' with capo 2
  frets: [number, number, number, number, number, number];
  rootString: number;
  barre: boolean;
  simplified?: { from: string };   // e.g. { from: 'F' } when Fmaj7 replaced F
};

type NoteEvent = {
  tick: number;           // absolute from song start
  dur: number;
  string: number;
  fret: number;           // -1 for golpe (no pitch)
  finger: Finger;
  tech?: Technique;
  accent?: boolean;
  velocity: number;
  strumOffsetMs?: number; // rasgueado: stagger per string
};

type ChordMark = { tick: number; voicing: Voicing; soundingName: string };

type Arrangement = {
  style: Style;
  level: Level;
  patternId: string;
  capo: number;
  meter: { beatsPerBar: 3 | 4 | 12; accents?: number[] };
  bpm: number;
  bars: number;
  chordMarks: ChordMark[];
  events: NoteEvent[];    // sorted by tick, then string
  warnings: Array<{ code: 'simplified' | 'barre' | 'unsupported-chord' | 'slash-dropped'; message: string }>;
};

// Main entry
function arrange(input: AnalysisResult, opts: {
  style: Style; level: Level; patternId?: string; capo?: number | 'auto'; palo?: string;
}): Arrangement;
```

## 4. Algorithms (v1)

**Capo choice.** For capo 0–7, transpose every chord to shape space; cost = Σ per chord (0 if an open, non-barre voicing exists; 3 if only a barre exists) + 0.2 × capo. Choose the lowest. Basic level then applies beginner substitutions (F→Fmaj7, Bm→Bm7, B→B7, …). For flamenco in Phrygian/Andalusian keys, prefer capo positions that give E–F–G–Am shapes: the home chord is the commonest major chord with a major chord a semitone above it (E with F), else the dominant of a minor key (E in A minor); the capo puts it on the E shape, or on the A shape (A–Bb–C–Dm) when that would need a capo past 7. No home chord: the usual cost. An explicit `capo` wins.

**Voicing lookup order.** Slash chord in library → plain chord in library → (Basic only) simpler quality in library without barre → movable E/A shape with the lowest root fret.

**Root string.** Lowest sounded string whose pitch class equals the chord root; for slash chords, the lowest sounded string.

**Alt bass.** Root on string 0 → string 2 (else 1). Root on string 1 → string 2. Root on string ≥ 2 → an open lower string that's a chord tone (A for D chords), else root string + 1 if sounded.

**Scale walker (picado, v1 flamenco).** Walk the scale of the current key/mode from the current chord's root in the voicing position, staying within a 4-fret span on strings 0–3; alternate i/m with `apoyando`. Chord tones replace a scale note a semitone away (G# for G over E in A minor). The walk goes up and turns back at either end of the position; without a key it uses the chord root's major or minor scale.

**Playability check.** Reject a pattern for a chord if any simultaneous notes need a fret span > 4 or more than 4 fretted fingers; fall back to the next pattern at the same level, then the level below.

## 5. Renderer inputs

`<TabSheet arrangement={...} width={px} cursorIndex={n} showFingers showTechniques />`. Lanes from top: chord names, technique symbols, six strings (high e at the top), right-hand fingers. Wraps to 1–4 bars per system based on width.

## 6. Playback inputs

```ts
createPlayer({
  arrangement,
  original?: AudioBuffer,            // decoded clip; enables the Original and Both mixes
  beats?: { beatTimesSec, barStartBeat },  // from AnalysisResult
  onCursor: (eventIndex) => void,    // note being heard (output latency compensated)
  onEnd?: () => void,                // played to the end (not on stop or while looping)
  onStateChange?: (state: 'idle' | 'preparing' | 'playing') => void,
  context?: AudioContext,            // share one; otherwise the player owns it
}) → {
  play(fromBar?): Promise<void>,
  playFrom(tick): Promise<void>,      // any point in the song (restarts if playing); powers click-to-seek
  stop(),
  setTempoRatio(0.5–1): Promise<void>,   // pitch unchanged
  setLoop(barStart, barEnd) | setLoop(null),  // 0-based, inclusive
  setMix('sheet' | 'original' | 'both'),
  dispose(),
  state, tempoRatio,
}
```

- With `beats`, ticks map to seconds in the recording (linear between detected beats, extrapolated past the last), so the sheet follows its real tempo drift. Without them the sheet uses the steady `bpm`.
- Sheet notes and the original share one Web Audio clock. Playback is a series of passes (one per loop pass or tempo change); in each, a note at song time `s` plays at `audioStart + (s − songStart) / ratio` and the original starts at `songStart / ratio` in its time-stretched copy, so they cannot drift.
- Slower speeds play a WSOLA time-stretched copy of the original (pitch unchanged), prepared in the background and cached per ratio.
- Tempo, loop and mix changes take effect within the 150 ms lookahead.
