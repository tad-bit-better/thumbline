import type { AnalysisResult } from '@thumbline/engine';
import { createSongStore, effectiveAnalysis, memoryStorage } from './song-store';

const analysis: AnalysisResult = {
  version: 1,
  durationSec: 20,
  bpm: 96,
  beatTimesSec: Array.from({ length: 33 }, (_, i) => 0.3 + i * 0.625),
  barStartBeat: 0,
  meter: { beatsPerBar: 4 },
  key: { pc: 7, mode: 'major' },
  chords: [
    { bar: 0, beat: 0, chord: { pc: 7, quality: 'maj' }, confidence: 0.9, alternatives: [] },
    { bar: 1, beat: 0, chord: { pc: 2, quality: 'maj' }, confidence: 0.3, alternatives: [{ pc: 11, quality: 'm' }] },
    { bar: 2, beat: 2, chord: { pc: 4, quality: 'm' }, confidence: 0.8, alternatives: [] },
  ],
};

const file = () => new File([new Uint8Array([1, 2, 3])], 'song.mp3', { type: 'audio/mpeg' });

describe('song store', () => {
  it('starts a song and clears any previous analysis and edits', () => {
    const store = createSongStore(memoryStorage());
    store.getState().startSong(file());
    store.getState().setAnalysis(analysis);
    store.getState().setChord(1, { pc: 11, quality: 'm' });
    store.getState().startSong(file());
    const s = store.getState();
    expect(s.meta).toMatchObject({ name: 'song.mp3', type: 'audio/mpeg', size: 3 });
    expect(s.analysis).toBeNull();
    expect(s.edits).toEqual({ chords: {}, confirmed: [] });
  });

  it('records chord edits as confirmed', () => {
    const store = createSongStore(memoryStorage());
    store.getState().setAnalysis(analysis);
    store.getState().setChord(1, { pc: 11, quality: 'm' });
    expect(store.getState().edits).toEqual({ chords: { 1: { pc: 11, quality: 'm' } }, confirmed: [1] });
  });

  it('keeps sheet preferences across songs', () => {
    const store = createSongStore(memoryStorage());
    store.getState().setStyle('fingerstyle');
    store.getState().setLevel('advanced');
    store.getState().setMix('original');
    store.getState().setSpeed(0.75);
    store.getState().startSong(file());
    expect(store.getState().prefs).toMatchObject({ style: 'fingerstyle', level: 'advanced', mix: 'original', speed: 0.75 });
  });

  it('cycles through patterns per style and level', () => {
    const store = createSongStore(memoryStorage());
    store.getState().cyclePattern(2);
    expect(store.getState().prefs.pattern['arpeggio.basic']).toBe(1);
    store.getState().cyclePattern(2);
    expect(store.getState().prefs.pattern['arpeggio.basic']).toBe(0);
  });

  it('persists and restores the song, file included', async () => {
    const storage = memoryStorage();
    const a = createSongStore(storage);
    a.getState().startSong(file());
    a.getState().setAnalysis(analysis);
    a.getState().setMeter(3);
    await a.getState().flush();
    const b = createSongStore(storage);
    expect(b.getState().hydrated).toBe(false);
    await b.getState().hydrate();
    expect(b.getState()).toMatchObject({ hydrated: true, meta: { name: 'song.mp3' }, analysis, edits: { beatsPerBar: 3 } });
    expect(b.getState().file).toBeInstanceOf(Blob);
  });

  it('restores the clip where Blobs cannot be stored (WebKit private sessions)', async () => {
    const inner = memoryStorage();
    const noBlobs = {
      ...inner,
      set: async (k: string, v: unknown) => {
        if (JSON.stringify(v, (_, x) => (x instanceof Blob ? 'BLOB' : x)).includes('BLOB')) throw new Error('DataCloneError');
        await inner.set(k, v);
      },
    };
    const a = createSongStore(noBlobs);
    a.getState().startSong(file());
    a.getState().setMix('sheet');
    await a.getState().flush();
    const b = createSongStore(noBlobs);
    await b.getState().hydrate();
    expect(b.getState()).toMatchObject({ meta: { name: 'song.mp3' }, prefs: { mix: 'sheet' } });
    const restored = b.getState().file as Blob;
    expect(restored.type).toBe('audio/mpeg');
    expect([...new Uint8Array(await restored.arrayBuffer())]).toEqual([1, 2, 3]);
  });

  it('hydrates to an empty state when nothing is stored', async () => {
    const store = createSongStore(memoryStorage());
    await store.getState().hydrate();
    expect(store.getState()).toMatchObject({ hydrated: true, meta: null, analysis: null });
  });

  it('forgets the song on clear', async () => {
    const storage = memoryStorage();
    const store = createSongStore(storage);
    store.getState().startSong(file());
    await store.getState().flush();
    store.getState().clear();
    await store.getState().flush();
    const again = createSongStore(storage);
    await again.getState().hydrate();
    expect(again.getState().meta).toBeNull();
  });
});

describe('effectiveAnalysis', () => {
  it('applies chord edits', () => {
    const r = effectiveAnalysis(analysis, { chords: { 1: { pc: 11, quality: 'm' } }, confirmed: [1] });
    expect(r.chords[1].chord).toEqual({ pc: 11, quality: 'm' });
    expect(r.chords[1].confidence).toBe(1);
    expect(r.chords[0]).toBe(analysis.chords[0]);
  });

  it('regroups beats into bars when the meter changes', () => {
    const r = effectiveAnalysis(analysis, { chords: {}, confirmed: [], beatsPerBar: 3 });
    expect(r.meter.beatsPerBar).toBe(3);
    // absolute beats 0, 4, 10 → 3/4 bars
    expect(r.chords.map((c) => [c.bar, c.beat])).toEqual([
      [0, 0],
      [1, 1],
      [3, 1],
    ]);
  });

  it('returns the analysis unchanged without edits', () => {
    expect(effectiveAnalysis(analysis, { chords: {}, confirmed: [] })).toBe(analysis);
  });
});
