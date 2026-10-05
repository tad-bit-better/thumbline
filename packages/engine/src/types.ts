// Contracts from docs/engine-spec.md. Change them only together with the spec.

// §1 AnalysisResult (audio-analysis → engine)

export type Quality =
  | 'maj'
  | 'm'
  | '7'
  | 'm7'
  | 'maj7'
  | 'sus2'
  | 'sus4'
  | 'dim'
  | 'add9'
  | '6';

/** `bassPc` is set for slash chords only. */
export type ChordLabel = { pc: number; quality: Quality; bassPc?: number };

export type ChordSegment = {
  /** 0-based */
  bar: number;
  /** 0-based beat within the bar where the chord starts */
  beat: number;
  /** null = no chord / silence */
  chord: ChordLabel | null;
  /** 0..1 */
  confidence: number;
  /** up to 3, best first */
  alternatives: ChordLabel[];
};

export type BeatsPerBar = 3 | 4 | 12;

export type Meter = { beatsPerBar: BeatsPerBar; accents?: number[] };

export type AnalysisResult = {
  version: 1;
  durationSec: number;
  bpm: number;
  /** every detected beat, for audio sync */
  beatTimesSec: number[];
  /** index into beatTimesSec of bar 0's downbeat */
  barStartBeat: number;
  meter: Meter;
  key: { pc: number; mode: 'major' | 'minor' | 'phrygian' };
  /** sorted by (bar, beat) */
  chords: ChordSegment[];
  /**
   * Where the key changes (bar 0 first, sorted by bar); absent when the key never
   * changes (or the clip was analysed before M10b): then `key` holds everywhere.
   * When present, `key` is the one held longest.
   */
  keys?: KeySpan[];
  /** The tune (lead voice), cleaned but not quantised; absent for clips analysed before M9 */
  melody?: MelodyNote[];
  /** How the song feels; absent for clips analysed before M10 */
  mood?: Mood;
  /** Loudness per beat (index as beatTimesSec), 0..1 with the loud end of the song at 1 */
  beatEnergy?: number[];
};

/** The key from `bar` on, until the next span. */
export type KeySpan = { bar: number; key: AnalysisResult['key'] };

/** 0..1 each: energy calm → driving, valence dark → bright. */
export type Mood = { energy: number; valence: number };

/** One note of the tune, in sounding pitch and seconds into the recording. */
export type MelodyNote = {
  startSec: number;
  durSec: number;
  /** sounding MIDI pitch, as sung (the engine moves it into guitar range) */
  midi: number;
  /** 0..1, how sure the tracker was */
  confidence: number;
};

// §2 Pattern DSL

export type Style = 'arpeggio' | 'fingerstyle' | 'flamenco';
export type Level = 'basic' | 'moderate' | 'advanced';
export type Finger = 'p' | 'i' | 'm' | 'a' | 'c';

export type Target =
  | 'bass'
  | 'altBass'
  | 't1'
  | 't2'
  | 't3'
  | 't4'
  | 'scale'
  | 'campanella'
  | 'drone'
  | 'pedal'
  | 'all';

export type Technique =
  | 'tirando'
  | 'apoyando'
  | 'rasgueo-down'
  | 'rasgueo-up'
  | 'golpe'
  | 'tremolo'
  | 'hammer'
  | 'pull'
  | 'pinch'
  | 'palm-mute'
  | 'slap'
  | 'harmonic'
  | 'apagado'
  /** A slow strum across the strings (fingerstyle): down = low to high, up = a light flick back up the top strings */
  | 'brush-down'
  | 'brush-up';

export type PatternEvent = {
  /** start, relative to the start of the chord segment or bar (see anchor) */
  tick: number;
  /** ticks */
  dur: number;
  finger: Finger;
  target: Target;
  tech?: Technique;
  accent?: boolean;
  /** 0..1, default 0.8 */
  velocity?: number;
};

export type Palo = 'rumba' | 'tangos' | 'solea' | 'bulerias' | 'alegrias';

/** engine-spec §4 mood, the quadrant of AnalysisResult.mood. */
export type MoodLabel = 'melancholic' | 'warm' | 'intense' | 'upbeat';

/** How much a bar plays, from the song's loudness (engine-spec §4 sections). */
export type SectionLevel = 'soft' | 'normal' | 'full';

export type PatternDef = {
  /** e.g. 'arpeggio.moderate.pami' */
  id: string;
  /** user-facing */
  name: string;
  /** one-sentence how-to shown under the name */
  hint: string;
  style: Style;
  level: Level;
  meters: BeatsPerBar[];
  anchor: 'bar' | 'chord';
  events: Partial<Record<BeatsPerBar, PatternEvent[]>>;
  requires?: { openTreble?: boolean; maxFret?: number };
  palos?: Palo[];
  /** moods the pattern suits; they come first for that mood */
  moods?: MoodLabel[];
};

// §3 Arrangement (engine → renderer, playback)

export type Frets = [number, number, number, number, number, number];

export type Voicing = {
  /** shape name as played, e.g. 'Em' with capo 2 */
  name: string;
  frets: Frets;
  rootString: number;
  barre: boolean;
  /** e.g. { from: 'F' } when Fmaj7 replaced F */
  simplified?: { from: string };
};

export type NoteEvent = {
  /** absolute from song start */
  tick: number;
  dur: number;
  string: number;
  /** -1 for golpe, slap and apagado (no pitch); 12, 7 or 5 for a harmonic */
  fret: number;
  finger: Finger;
  tech?: Technique;
  accent?: boolean;
  velocity: number;
  /** rasgueado: stagger per string */
  strumOffsetMs?: number;
  /** a note of the tune: on top, louder, and drawn bold */
  melody?: true;
  /** a chord tone harmonising the tune note above it (M11) */
  harmony?: true;
  /** a short run into the next tune note, where the tune rests (M11) */
  fill?: true;
};

export type ChordMark = { tick: number; voicing: Voicing; soundingName: string };

export type WarningCode =
  | 'simplified'
  | 'barre'
  | 'unsupported-chord'
  | 'slash-dropped';

export type Arrangement = {
  style: Style;
  level: Level;
  patternId: string;
  capo: number;
  meter: Meter;
  bpm: number;
  bars: number;
  chordMarks: ChordMark[];
  /** sorted by tick, then string */
  events: NoteEvent[];
  warnings: Array<{ code: WarningCode; message: string }>;
  /** the mood it was arranged for, when known: its quadrant, which picked the pattern */
  mood?: MoodLabel;
  /** the mood's values (playback sets tone, room and strum speed from them) */
  feel?: Mood;
  /** per bar, how much it plays */
  sections?: SectionLevel[];
};

export type ArrangeOptions = {
  style: Style;
  level: Level;
  patternId?: string;
  capo?: number | 'auto';
  palo?: string;
  /** Put the tune on top when the analysis has one (default true). */
  melody?: boolean;
  /** Override the detected mood: a preset, or the sliders' values. */
  mood?: MoodLabel | Mood;
};
