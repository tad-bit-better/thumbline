import type { AnalysisResult, ChordLabel, ChordSegment, Level, Style } from '@thumbline/engine';

/** The flamenco palos v1 plays. */
export type Palo = 'rumba' | 'tangos';
import type { Mix } from '@thumbline/playback';
import { del, get, set } from 'idb-keyval';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

export type SongMeta = { name: string; type: string; size: number };

/** What the user changed on the Review screen, kept apart from the raw analysis. */
export type Edits = {
  /** Segment index → chosen chord. */
  chords: Record<number, ChordLabel | null>;
  /** Segment indexes the user confirmed. */
  confirmed: number[];
  beatsPerBar?: 3 | 4;
};

export type Speed = 0.5 | 0.75 | 1;

export type SheetPrefs = {
  style: Style;
  level: Level;
  palo: Palo;
  /** Pattern index per `style.level`. */
  pattern: Partial<Record<string, number>>;
  mix: Mix;
  speed: Speed;
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
  setStyle: (style: Style) => void;
  setLevel: (level: Level) => void;
  setPalo: (palo: Palo) => void;
  /** Move to the next of `count` patterns for the current style and level. */
  cyclePattern: (count: number) => void;
  setMix: (mix: Mix) => void;
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
const DEFAULT_PREFS: SheetPrefs = { style: 'arpeggio', level: 'basic', palo: 'rumba', pattern: {}, mix: 'both', speed: 1 };

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
      setStyle: (style) => update({ prefs: { ...getState().prefs, style } }),
      setLevel: (level) => update({ prefs: { ...getState().prefs, level } }),
      setPalo: (palo) => update({ prefs: { ...getState().prefs, palo } }),
      cyclePattern: (count) => {
        const { prefs } = getState();
        const key = patternKey();
        update({ prefs: { ...prefs, pattern: { ...prefs.pattern, [key]: ((prefs.pattern[key] ?? 0) + 1) % Math.max(1, count) } } });
      },
      setMix: (mix) => update({ prefs: { ...getState().prefs, mix } }),
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
                edits: saved.edits ?? EMPTY_EDITS,
                prefs: { ...DEFAULT_PREFS, ...saved.prefs },
              }
            : {}),
        });
      },
      flush: () => pending,
    };
  });
  return store;
}

/** Re-bar a segment for a new meter, keeping its absolute beat. */
function rebar(seg: ChordSegment, from: number, to: number): ChordSegment {
  const beat = seg.bar * from + seg.beat;
  return { ...seg, bar: Math.floor(beat / to), beat: beat % to };
}

/** The analysis as the user corrected it: chord edits applied, beats regrouped for a new meter. */
export function effectiveAnalysis(analysis: AnalysisResult, edits: Edits): AnalysisResult {
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
