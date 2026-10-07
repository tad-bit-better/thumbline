import { type AnalysisResult, type ChordLabel, type ChordSegment, type Level, MOOD_CENTRES, type Mood, type MoodLabel, type Style } from '@thumbline/engine';

/** The flamenco palos v1 plays. */
export type Palo = 'rumba' | 'tangos';
import type { Mix } from '@thumbline/playback';
import { type TempoScale, scaleTempo } from './tempo';
import { del, get, set } from 'idb-keyval';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

export type SongMeta = { name: string; type: string; size: number };

/** What the user changed on the sheet, kept apart from the raw analysis. */
export type Edits = {
  /** Segment index → chosen chord. */
  chords: Record<number, ChordLabel | null>;
  /** Segment indexes the user confirmed. */
  confirmed: number[];
  beatsPerBar?: 3 | 4;
  /** The mood the user set over the detected one (M10): a preset's values or the sliders'. */
  mood?: Mood;
  /** The capo the sheet was first written with: a chord change doesn't move it (the reader asks to re-pick). */
  capo?: number;
  /** Count the song at half or double the tempo we heard (the beat finder can lock onto twice the pulse). */
  tempoScale?: TempoScale;
};

export type Speed = 0.5 | 0.75 | 1;

export type SheetPrefs = {
  style: Style;
  level: Level;
  palo: Palo;
  /** Pattern index per `style.level`. */
  pattern: Partial<Record<string, number>>;
  mix: Mix;
  /** The original under the sheet in Both, 0–1. */
  originalLevel: number;
  /** How much the guitar fills in, 1–10 (engine-spec §4 fullness). */
  fullness: number;
  speed: Speed;
  /** How the tab is shown (Sheet v2, screens.md §4). */
  display: DisplayPrefs;
};

export type DisplayPrefs = {
  /** Under a capo: the shape, what it sounds like, or both. */
  chordNames: 'shape' | 'sounding' | 'both';
  tabSize: 's' | 'm' | 'l';
  fingers: boolean;
  legend: boolean;
};

type Saved = { meta: SongMeta | null; file: Blob | null; analysis: AnalysisResult | null; edits: Edits; prefs: SheetPrefs };
/**
 * The clip is saved as bytes under its own key, written once per song.
 * WebKit can't store Blobs in IndexedDB in private or ephemeral sessions.
 */
type SavedClip = { bytes: ArrayBuffer; type: string };

export type SongState = Saved & {
  hydrated: boolean;
  /** A problem with the last clip, shown on the Upload screen. Not saved. */
  uploadError: string | null;
  setUploadError: (message: string | null) => void;
  startSong: (file: File) => void;
  setAnalysis: (analysis: AnalysisResult) => void;
  /** Forget the analysis (and its chord edits) so the clip is listened to again. */
  relisten: () => void;
  setChord: (segment: number, chord: ChordLabel | null) => void;
  setMeter: (beatsPerBar: 3 | 4) => void;
  setCapo: (capo: number) => void;
  setTempoScale: (scale: TempoScale) => void;
  setMood: (mood: Mood) => void;
  /** Go back to the mood we heard. */
  resetMood: () => void;
  setStyle: (style: Style) => void;
  setLevel: (level: Level) => void;
  setPalo: (palo: Palo) => void;
  /** Move to the next (or, with step -1, the previous) of `count` patterns for the current style and level. */
  cyclePattern: (count: number, step?: 1 | -1) => void;
  setDisplay: (display: Partial<DisplayPrefs>) => void;
  setMix: (mix: Mix) => void;
  setOriginalLevel: (level: number) => void;
  setFullness: (fullness: number) => void;
  setSpeed: (speed: Speed) => void;
  clear: () => void;
  hydrate: () => Promise<void>;
  /** Resolve once pending writes are stored. */
  flush: () => Promise<void>;
};

export type Storage = {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<void>;
  del: (key: string) => Promise<void>;
};

const KEY = 'thumbline:song:v1';
const CLIP_KEY = 'thumbline:clip:v1';
const EMPTY_EDITS: Edits = { chords: {}, confirmed: [] };
export const DEFAULT_DISPLAY: DisplayPrefs = { chordNames: 'both', tabSize: 'm', fingers: true, legend: true };
const DEFAULT_PREFS: SheetPrefs = { style: 'arpeggio', level: 'basic', palo: 'rumba', pattern: {}, mix: 'both', originalLevel: 0.9, fullness: 5, speed: 1, display: DEFAULT_DISPLAY };

export function memoryStorage(): Storage {
  const map = new Map<string, unknown>();
  return {
    get: async (k) => map.get(k),
    set: async (k, v) => void map.set(k, v),
    del: async (k) => void map.delete(k),
  };
}

/** Song state, saved to IndexedDB (the clip never leaves the device). */
export function createSongStore(storage: Storage) {
  let pending: Promise<void> = Promise.resolve();
  const store = createStore<SongState>()((setState, getState) => {
    const save = () => {
      const { meta, analysis, edits, prefs } = getState();
      pending = pending.then(() => (meta ? storage.set(KEY, { meta, analysis, edits, prefs }) : storage.del(KEY))).catch(() => undefined);
    };
    const saveClip = (file: Blob | null) => {
      pending = pending
        .then(async () => (file ? storage.set(CLIP_KEY, { bytes: await file.arrayBuffer(), type: file.type } satisfies SavedClip) : storage.del(CLIP_KEY)))
        .catch(() => undefined);
    };
    const update = (partial: Partial<SongState>) => {
      setState(partial);
      save();
    };
    const patternKey = () => `${getState().prefs.style}.${getState().prefs.level}`;

    return {
      hydrated: false,
      uploadError: null,
      setUploadError: (uploadError) => setState({ uploadError }),
      meta: null,
      file: null,
      analysis: null,
      edits: EMPTY_EDITS,
      prefs: DEFAULT_PREFS,
      startSong: (file) => {
        saveClip(file);
        update({ meta: { name: file.name, type: file.type, size: file.size }, file, analysis: null, edits: EMPTY_EDITS, uploadError: null });
      },
      setAnalysis: (analysis) => update({ analysis, edits: EMPTY_EDITS }),
      relisten: () => update({ analysis: null, edits: EMPTY_EDITS }),
      setChord: (segment, chord) => {
        const { edits } = getState();
        update({
          edits: {
            ...edits,
            chords: { ...edits.chords, [segment]: chord },
            confirmed: edits.confirmed.includes(segment) ? edits.confirmed : [...edits.confirmed, segment],
          },
        });
      },
      setMeter: (beatsPerBar) => update({ edits: { ...getState().edits, beatsPerBar } }),
      setCapo: (capo) => update({ edits: { ...getState().edits, capo } }),
      setTempoScale: (tempoScale) => update({ edits: { ...getState().edits, tempoScale } }),
      setMood: (mood) => update({ edits: { ...getState().edits, mood } }),
      resetMood: () => {
        const { mood: _dropped, ...rest } = getState().edits;
        update({ edits: rest });
      },
      setStyle: (style) => update({ prefs: { ...getState().prefs, style } }),
      setLevel: (level) => update({ prefs: { ...getState().prefs, level } }),
      setPalo: (palo) => update({ prefs: { ...getState().prefs, palo } }),
      cyclePattern: (count, step = 1) => {
        const { prefs } = getState();
        const key = patternKey();
        const n = Math.max(1, count);
        update({ prefs: { ...prefs, pattern: { ...prefs.pattern, [key]: ((((prefs.pattern[key] ?? 0) + step) % n) + n) % n } } });
      },
      setDisplay: (display) => {
        const { prefs } = getState();
        update({ prefs: { ...prefs, display: { ...prefs.display, ...display } } });
      },
      setMix: (mix) => update({ prefs: { ...getState().prefs, mix } }),
      setOriginalLevel: (originalLevel) => update({ prefs: { ...getState().prefs, originalLevel } }),
      setFullness: (fullness) => update({ prefs: { ...getState().prefs, fullness } }),
      setSpeed: (speed) => update({ prefs: { ...getState().prefs, speed } }),
      clear: () => {
        saveClip(null);
        update({ meta: null, file: null, analysis: null, edits: EMPTY_EDITS });
      },
      hydrate: async () => {
        const saved = (await storage.get(KEY).catch(() => undefined)) as Partial<Saved> | undefined;
        const clip = saved?.meta ? ((await storage.get(CLIP_KEY).catch(() => undefined)) as SavedClip | undefined) : undefined;
        setState({
          hydrated: true,
          ...(saved?.meta
            ? {
                meta: saved.meta,
                // Older saves kept the Blob beside the song.
                file: clip ? new Blob([clip.bytes], { type: clip.type }) : (saved.file ?? null),
                analysis: saved.analysis ?? null,
                edits: migrateEdits(saved.edits),
                prefs: { ...DEFAULT_PREFS, ...saved.prefs, display: { ...DEFAULT_DISPLAY, ...saved.prefs?.display } },
              }
            : {}),
        });
      },
      flush: () => pending,
    };
  });
  return store;
}

/** Saves from the first M10 build kept the mood as a label; it is now the label's values. */
function migrateEdits(edits: Edits | undefined): Edits {
  if (!edits) return EMPTY_EDITS;
  const mood = edits.mood as Mood | MoodLabel | undefined;
  return typeof mood === 'string' ? { ...edits, mood: MOOD_CENTRES[mood] } : edits;
}

/** Re-bar a segment for a new meter, keeping its absolute beat. */
function rebar(seg: ChordSegment, from: number, to: number): ChordSegment {
  const beat = seg.bar * from + seg.beat;
  return { ...seg, bar: Math.floor(beat / to), beat: beat % to };
}

/** The analysis as the user corrected it: chord edits applied, beats regrouped for a new meter, counted at their tempo. */
export function effectiveAnalysis(analysis: AnalysisResult, edits: Edits): AnalysisResult {
  return scaleTempo(withEdits(analysis, edits), edits.tempoScale ?? 1);
}

function withEdits(analysis: AnalysisResult, edits: Edits): AnalysisResult {
  const edited = Object.keys(edits.chords).length > 0;
  const meter = edits.beatsPerBar && edits.beatsPerBar !== analysis.meter.beatsPerBar ? edits.beatsPerBar : null;
  if (!edited && !meter) return analysis;
  const from = analysis.meter.beatsPerBar;
  const chords = analysis.chords.map((seg, i) => {
    const chord = i in edits.chords ? edits.chords[i] : undefined;
    const withChord = chord === undefined ? seg : { ...seg, chord, confidence: 1 };
    return meter ? rebar(withChord, from, meter) : withChord;
  });
  return { ...analysis, chords, meter: meter ? { ...analysis.meter, beatsPerBar: meter } : analysis.meter };
}

const idbStorage: Storage = { get, set, del };

/** The app's store (IndexedDB). */
export const songStore = createSongStore(idbStorage);

export function useSong<T>(select: (s: SongState) => T): T {
  return useStore(songStore, select);
}
