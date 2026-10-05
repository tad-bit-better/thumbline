import type { AnalysisResult } from '@thumbline/engine';
import { detectedMood, effectiveMood, moodName } from './mood';

const analysis = (mood?: AnalysisResult['mood']) => ({ mood }) as AnalysisResult;
const NO_EDITS = { chords: {}, confirmed: [] };

describe('mood helpers', () => {
  it('reads the detected mood, and none for songs read before moods', () => {
    expect(detectedMood(analysis({ energy: 0.2, valence: 0.1 }))).toBe('melancholic');
    expect(detectedMood(analysis())).toBeUndefined();
  });

  it('lets the user’s choice win', () => {
    expect(effectiveMood(analysis({ energy: 0.2, valence: 0.1 }), { ...NO_EDITS, mood: { energy: 0.7, valence: 0.6 } })).toEqual({ energy: 0.7, valence: 0.6 });
    expect(effectiveMood(analysis({ energy: 0.9, valence: 0.9 }), NO_EDITS)).toEqual({ energy: 0.9, valence: 0.9 });
  });

  it('names moods in plain words', () => {
    expect(moodName('melancholic')).toBe('Sad');
    expect(moodName('upbeat')).toBe('Happy');
  });
});
