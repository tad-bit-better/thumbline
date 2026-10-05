# Engine spec

Contracts between packages. Change these only together with the code that uses them.

## Conventions
- **Strings:** index 0 = low E (6th string) … 5 = high e (1st string).
- **Frets:** relative to the capo. `-1` = muted, `0` = open (or at the capo). A `harmonic` note's fret is its node (12 or 7, also relative to the capo).
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
  keys?: KeySpan[];            // where the key changes, bar 0 first; absent when it never does (then `key` holds everywhere); `key` = the longest-held
  melody?: MelodyNote[];       // the tune; absent for clips analysed before M9
  mood?: Mood;                 // how the song feels; absent before M10
  beatEnergy?: number[];       // loudness per beat (as beatTimesSec), 0..1, the loud end of the song = 1
};

type KeySpan = { bar: number; key: AnalysisResult['key'] }; // the key from `bar` until the next span

type Mood = { energy: number; valence: number }; // 0..1: calm → driving, dark → bright

type MelodyNote = {
  startSec: number;            // seconds into the recording
  durSec: number;
  midi: number;                // sounding pitch as sung; the engine moves it into guitar range
  confidence: number;          // 0..1
};
```

**Key mode (M10).** The key finder can't tell a key from its relative (C major / A minor share every note). After the chords are found, each chord counts for its length in beats (the first and last twice); if the relative's tonic chord (major family vs m, m7) outweighs the key's own by 1.2×, the key moves to the relative. The mood uses this key.

**Free time (M10b).** In rubato stretches the beat tracker often locks onto another pulse (1.5× or 2× the song's), so the pattern rushes and the bar lines after it slip. Where the local beat (median of the 5 intervals around each) stays outside 0.85–1.18× the song's median beat for 4+ intervals, that stretch's beats are re-spaced evenly at the nearest whole number of the song's beats, keeping its first and last.

**Key changes (M10b).** Songs often change key (My Heart Will Go On steps up a half step). After a first pass of chords, each bar scores the twelve scales (a major key with its relative minor, the minor's raised 7th included): per beat, minus the share of the chord's notes outside the scale, plus 0.1 when the chord is the scale's home (I, or vi as the relative minor's i). The best path through the bars may change scale at a cost of 6; a section under 8 bars joins its neighbour. Each section then picks major or relative minor as above. With more than one section the chords are chosen again with each bar's key, the sections found again, and `keys` lists them; `key` becomes the one held for the most bars. Tune cleanup snaps into the key of the moment, and the engine uses the key of each chord's bar (scale walker, hammer-ons, drone, pedal, moving top line).

**Mood (M10).** energy = 40% tempo (60→140 bpm), 30% onset rate (1.5→5 per s), 30% danceability (0.8→2); valence = 55% a major key, 25% the share of major chords (maj, 7, maj7, 6, add9), 20% brightness (spectral centroid 1200→3000 Hz). Each part is clamped to 0..1. `beatEnergy` is each beat's RMS over the 95th percentile, clamped to 1.

**Melody (M9).** The worker tracks the lead voice (essentia `PredominantPitchMelodia`, then `PitchContourSegmentation`) and cleans it: notes under 90 ms are dropped, a note 9+ semitones from the median of its six neighbours moves an octave toward them, a held note split in two (same pitch, gap under 120 ms) is merged, and a short (under 350 ms) note outside the key moves a semitone into it. Notes stay in seconds; the engine quantises them.

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
  | 'campanella' // next note of a campanella run: scale notes on alternating strings (§4)
  | 'drone'     // an open top string that rings through every chord (§4)
  | 'pedal'     // an open bass string on the key's tonic or fifth, held under every chord (§4)
  | 'all';      // all sounded strings (rasgueado, plucked chord)

type Technique =
  | 'tirando' | 'apoyando'          // free stroke / rest stroke
  | 'rasgueo-down' | 'rasgueo-up'   // flamenco rasgueado strokes
  | 'brush-down' | 'brush-up'       // fingerstyle slow strums (M11): a roll or brush down across the strings, a light flick up the top strings
  | 'golpe'                         // tap on the top, no pitch
  | 'tremolo'                       // repeated note p-a-m-i
  | 'hammer' | 'pull'               // left-hand legato from the previous note on that string
  | 'pinch'                         // simultaneous thumb + finger
  | 'palm-mute'                     // heel of the hand damps the string: short and dark
  | 'slap'                          // side of the thumb bounces off the bass strings, no pitch
  | 'harmonic'                      // natural harmonic: finger touches the node (fret 12 or 7)
  | 'apagado';                      // the hand lands on the strings and stops the strum, no pitch

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
  moods?: Array<'melancholic' | 'warm' | 'intense' | 'upbeat'>;       // moods it suits; listed first for them
};
```

**Rules the pattern runner applies (not the pattern):**
- When a chord changes on a tick with no `bass` event, insert a `bass` event (finger `p`) at that tick and drop any `altBass` there.
- Events whose target string is muted in the voicing are dropped.
- Two events on the same string at the same tick: keep the first.
- `hammer`/`pull` need a previous note on the same string within one beat; otherwise the runner substitutes a normal stroke. A hammer-on needs that note lower and a pull-off needs it higher. When it sits on the same fret, the runner moves one end to where the string rests with the finger lifted, the barre or the open string (open only up to fret 2): a hammer-on starts there, a pull-off lands there (open only when that note is in the key's scale). An open chord tone may instead hammer up two frets to a scale note when a free finger can reach it (span and finger limits of §4).
- A `golpe`, `slap` or `apagado` event becomes one pitchless note (string 0, fret -1, its tech) whatever its target, and doesn't take a string's slot, so it can land with a strum or a bass note on the same tick. The thumb may play `slap` and `apagado` on any target.
- A `harmonic` event sounds its target string's natural harmonic at fret 12 (the open note an octave up) if that is a chord tone, else fret 7 (an octave and a fifth up); if neither is, the note is played normally without the tech. A harmonic is also dropped (the shape's fret comes back) when a fretted note sounds on the same tick, since the fretting hand must be off the strings. Harmonics are ignored by the playability check and the moving top line.
- A `scale` target takes the next note from the scale walker (§4), one per event; `campanella` likewise from the campanella walker. `drone` and `pedal` resolve from the key (§4).
- Flamenco patterns list their `palos`; `arrange` keeps to the requested palo (default `rumba`; v1 plays `rumba` and `tangos`, others throw), including when it falls back a level.

**Moving top line (after the runner, Moderate and Advanced only, not flamenco):** plucked notes on the shape's top string (the `t1` string) may change fret, so the line moves instead of repeating one note. Within each chord, notes alternate between a chord tone and a neighbour, starting with the chord tone nearest the previous chord's last top note. The neighbour is the next chord tone up within 5 semitones; else a note of the song's key 2–3 semitones up; else the same downwards. Every fret stays within reach of the shape (fretted notes at most 3 frets apart, at most 4 fingers, no open string under a barre). Thumb notes, strums, golpes and chords with a hammer-on or pull-off on that string are left alone. Basic sheets keep the shape's own top note. `chordMarks[].voicing` still shows the base shape.

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
  fret: number;           // -1 for golpe, slap, apagado (no pitch); the node (12, 7) for a harmonic
  finger: Finger;
  tech?: Technique;
  accent?: boolean;
  velocity: number;
  strumOffsetMs?: number; // rasgueado: stagger per string
  melody?: true;          // a note of the tune: on top, louder, drawn bold
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
  mood?: 'melancholic' | 'warm' | 'intense' | 'upbeat'; // its quadrant, which picked the pattern
  feel?: { energy: number; valence: number };           // the values (detected, a preset, or the sliders)
  sections?: Array<'soft' | 'normal' | 'full'>;          // per bar, how much it plays
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

**Scale walker (picado, v1 flamenco).** Walk the scale of the current key/mode from the current chord's root in the voicing position, staying within a 4-fret span on strings 0–3; alternate i/m with `apoyando`. Chord tones replace a scale note a semitone away (G# for G over E in A minor). The walk goes up and turns back at either end of the position; without a key it uses the chord root's major or minor scale. The thumb may walk it too, with rest strokes (pulgar).

**Campanella.** The same scale on strings 2–5, within the hand position stretched by a fret (frets 1–5 in first position) plus open strings, ascending. Each note goes on a different string from the one before when it can, preferring an open string, then the higher string, so neighbouring notes overlap like bells (B open, then C on the G string's 5th fret). No scale note is skipped. Walked like picado.

**Drone and pedal.** A `drone` is the open 1st string, else the open 2nd, when its note is in the key's scale (chord tones included), whatever the chord; otherwise the shape's top note. A `pedal` is the key's tonic, else its fifth, on an open E, A or D string; otherwise the chord's bass. Neither uses an open string a barre covers. The chord's own bass still sounds on each chord change. The moving top line doesn't apply to flamenco.

**Playability check.** Reject a pattern for a chord if any simultaneous notes need a fret span > 4 or more than 4 fretted fingers; fall back to the next pattern at the same level, then the level below.

**Rolls (M11).** A guitarist opens a phrase, and ends the song, with a slow strum that lets the chord ring. Before the tune is merged (not flamenco): the chord starting on the first bar of each phrase (every 4 bars; every 8 when the mood's energy is 0.5+) and the song's last chord open with a thumb `brush-down` across every string of the shape, replacing the plucks on that tick; a string with a hammer-on or pull-off in the chord's first beat keeps its own note. Velocity: 0.75 × the loudest pluck it replaced. The roll lasts up to two beats; the last chord's rings to the end. The tune then takes its string as usual. Patterns may also use brushes (index down across t3–t1, up across t1–t2). Brushes are left out of the moving top line, keep their length under the mood's touch, and weigh ×0.7 in the dynamics.

**Dynamics (M9).** After the tune is merged and before the mood's touch, not every note weighs the same. Pattern notes: the thumb ×0.82, inner fingers ×0.66; then the downbeat ×1.1, the middle of the bar ×1.04, off-eighths ×0.92, off-sixteenths ×0.85. The tune, phrase by phrase (a rest of a beat or more starts a new one): it swells from ×0.8 at its first note to ×1.05 at its highest and falls back after; ±1.5% a semitone from the phrase's middle pitch; ×1.05 for a note held a beat or more; ×0.9 for the phrase's last note. Golpes, slaps and apagados keep their weight; velocities stay within 0.2..1.

**Mood (M10).** The label is the quadrant of the mood's values split at 0.5: melancholic (calm, dark), warm (calm, bright), intense (driving, dark), upbeat (driving, bright). `ArrangeOptions.mood` overrides the detected mood with a preset (its quadrant's centre: 0.25 or 0.75 on each axis) or with slider values. The arrangement reports both (`mood`, `feel`). Without a mood (clips analysed before M10, no override) nothing below applies.
- *Pattern:* a level's patterns are listed with the ones whose `moods` include the label first, otherwise in their usual order; the first is the default.
- *Touch* (pattern notes only; the tune keeps its own), from the values: velocity × (0.8 + 0.25 × energy), at most 1; when calm (energy under 0.5) only the accent on a bar's first beat stays and palm mutes are dropped (the bass rings; a muted bass thuds on a ballad); when driving the thumb is cut to an eighth; when driving and bright every pattern note is. Playback sets tone, room and strum speed from `Arrangement.feel` (§6).

**Sections (M10).** From `beatEnergy`: each bar's loudness is the mean of its beats, averaged over 4-bar phrases from bar 0. The song's own quiet and loud levels are the 20th and 80th percentile of its phrases; if they are less than 0.08 apart, every bar is normal. Otherwise a phrase in the quietest quarter of that spread is soft and one in the loudest quarter is full (relative, so a mastered verse only a little quieter than its chorus still reads). Soft bars keep the tune, thumb notes, golpes and notes on a beat, at ×0.8 velocity; full bars play everything at ×1.1 with the bar's first beat accented.

## 5. Renderer inputs

`<TabSheet arrangement={...} width={px} cursorIndex={n} showFingers showTechniques />`. Lanes from top: chord names, technique symbols, six strings (high e at the top), right-hand fingers. Wraps to 1–4 bars per system based on width. Technique marks: `h`/`p` slurs, accent, rasgueado arrows, pinch bracket, apoyando and tremolo marks, `PM` (palm mute), and chips for golpe `G`, slap `S` and apagado `×`. A harmonic's fret is written in angle brackets: `<12>`.

Playback gives each technique its own sound: legato notes swell in without a pluck, palm-muted notes die in about 0.2 s, a harmonic is a soft, bell-like tone at its sounding pitch, a slap is a thud with a bright snap, and an apagado stops every ringing string with a short dull chunk.

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

**Feel (M10).** From `Arrangement.feel` (energy e, valence v): strum step 20 − 12e ms between strings (rasgueado), slow-strum step 55 − 30e ms (brushes; an up-brush ×0.6 and ×0.8 gain), reverb send 0.34 − 0.18e, a high shelf at 3 kHz of −5 + 8v dB, and when e ≥ 0.5 pattern notes stop at their written length (the tune always rings). Without a feel: 12 ms, 40 ms, 0.22, 0 dB, ringing.

**Humanising (M9).** Playback plays like a person unless told not to: each moment (notes struck together move together) is nudged by a jitter of up to ±9 ms plus a phrase-long push and pull (±7 ms over 8 bars), divided by the speed ratio; each note's loudness varies by ±22%, ×1.08 on a beat and ×0.9 on an off-sixteenth. A string's previous note is damped over 30 ms when the next one starts. Touch: a note's gain is 0.72 × velocity^1.6 (so the dynamics in §4 are heard), ×1.3 for the tune; non-tune notes on the top three strings ×0.78. The pluck itself follows the velocity in three levels (under 0.5, under 0.78, above): a soft pluck rises over 9 ms with its excitation low-passed at 5× the pitch, a hard one over 1.5 ms at 11×. The tone (§ synth) is a nylon Karplus-Strong pluck with a pitch-scaled excitation and a loop low-pass (stronger on low strings), tuned so a note's spectral centroid sits near 1–1.5 kHz like fingerstyle recordings. The room's impulse is noise through a two-pole low-pass that closes from warm to dark over its 1.8 s, plus softened early reflections: about as bright as a note (the old one was nearly white noise and added ~0.9 kHz of fizz to the mix).
