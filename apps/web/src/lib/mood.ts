import { type AnalysisResult, MOOD_CENTRES, type Mood, type MoodLabel, moodLabelOf } from '@thumbline/engine';
import type { Edits } from './song-store';

/** The four moods in plain words (engine-spec §4 mood). */
export const MOOD_OPTIONS = [
  { value: 'melancholic', label: 'Sad' },
  { value: 'warm', label: 'Warm' },
  { value: 'intense', label: 'Intense' },
  { value: 'upbeat', label: 'Happy' },
] as const satisfies ReadonlyArray<{ value: MoodLabel; label: string }>;

export const moodName = (m: MoodLabel) => MOOD_OPTIONS.find((o) => o.value === m)?.label ?? m;

/** A preset's values: the middle of its quadrant. */
export const presetValues = (m: MoodLabel): Mood => MOOD_CENTRES[m];

/** What the song sounded like to us, if we could tell (songs read before M10 have no mood). */
export const detectedMood = (analysis: AnalysisResult): MoodLabel | undefined => (analysis.mood ? moodLabelOf(analysis.mood) : undefined);

/** The mood's values the sheet is arranged for: the user's, else what we heard. */
export const effectiveMood = (analysis: AnalysisResult, edits: Edits): Mood | undefined => edits.mood ?? analysis.mood;

/** Words for a slider value, for screen readers. */
export const energyWords = (v: number) => (v < 0.35 ? 'calm' : v > 0.65 ? 'driving' : 'steady');
export const colourWords = (v: number) => (v < 0.35 ? 'dark' : v > 0.65 ? 'bright' : 'mixed');
