import { arrange, patternCandidates, patternPlan } from './arrange.js';
import { progression } from './testing/progression.js';
import type { AnalysisResult, Mood } from './types.js';

const WARM: Mood = { energy: 0.3, valence: 0.7 };
const loop = (bars: number) => Array.from({ length: bars }, (_, i) => ['C', 'Am', 'F', 'G'][i % 4]).join(' | ');
/** 24 bars: a quiet verse (0–7), then a steady middle (8–23). */
const song = (energy?: number[]): AnalysisResult => ({ ...progression(loop(24)), mood: WARM, ...(energy ? { beatEnergy: energy } : {}) });
const VERSE_THEN_CHORUS = [...Array(32).fill(0.2), ...Array(32).fill(0.6), ...Array(32).fill(0.95)];

describe('vary by section (M11)', () => {
  it('a quiet section plays a sparser pattern than the rest', () => {
    const a = arrange(song(VERSE_THEN_CHORUS), { style: 'fingerstyle', level: 'moderate', melody: false });
    expect(a.patternChanges?.[0]).toMatchObject({ bar: 0 });
    const soft = a.patternChanges?.[0].patternId;
    expect(soft).not.toBe(a.patternId);
    expect(a.patternChanges?.some((c) => c.bar === 8 && c.patternId === a.patternId)).toBe(true);
  });

  it('a long steady stretch changes pattern every other eight bars, and comes back', () => {
    const a = arrange(song(), { style: 'fingerstyle', level: 'moderate', melody: false });
    expect(a.patternChanges?.map((c) => c.bar)).toEqual([0, 8, 16]);
    const [first, second, third] = (a.patternChanges ?? []).map((c) => c.patternId);
    expect(first).toBe(a.patternId);
    expect(second).not.toBe(first);
    expect(third).toBe(first);
  });

  it('keeps a pattern the user picked everywhere', () => {
    const a = arrange(song(VERSE_THEN_CHORUS), { style: 'fingerstyle', level: 'moderate', patternId: 'fingerstyle.moderate.travis', melody: false });
    expect(a.patternChanges).toBeUndefined();
  });

  it('keeps short songs on one pattern', () => {
    expect(arrange({ ...progression(loop(8)), mood: WARM }, { style: 'fingerstyle', level: 'moderate', melody: false }).patternChanges).toBeUndefined();
  });

  it('leaves flamenco to its palo', () => {
    expect(arrange(song(VERSE_THEN_CHORUS), { style: 'flamenco', level: 'moderate', melody: false }).patternChanges).toBeUndefined();
  });
});

describe('patternPlan', () => {
  const ids = (plan?: Array<{ id: string }>) => plan?.map((p) => p.id.split('.').pop());
  it('switches every eight bars through a long normal stretch', () => {
    const c = patternCandidates('fingerstyle', 'moderate', 4, undefined, undefined, 'upbeat');
    const plan = ids(patternPlan(c, 'moderate', 32, undefined, 'upbeat'));
    expect(plan?.[0]).toBe(plan?.[16]);
    expect(plan?.[8]).toBe(plan?.[24]);
    expect(plan?.[0]).not.toBe(plan?.[8]);
  });

  it('a calm pattern for quiet bars, the main one for loud bars', () => {
    const c = patternCandidates('fingerstyle', 'moderate', 4, undefined, undefined, 'warm');
    const sections = [...Array(8).fill('soft'), ...Array(8).fill('full')];
    const plan = ids(patternPlan(c, 'moderate', 16, sections, 'warm'));
    expect(plan?.[0]).toBe('ballad');
    expect(plan?.[8]).toBe(c[0].id.split('.').pop());
  });
});
