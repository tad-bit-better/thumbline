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
    expect(effectiveMood(analysis({ energy: 0.2, valence: 0.1 }), { ...NO_EDITS, mood: 'upbeat' })).toBe('upbeat');
    expect(effectiveMood(analysis({ energy: 0.9, valence: 0.9 }), NO_EDITS)).toBe('upbeat');
  });

  it('names moods in plain words', () => {
    expect(moodName('melancholic')).toBe('Sad');
    expect(moodName('upbeat')).toBe('Happy');
  });
});
