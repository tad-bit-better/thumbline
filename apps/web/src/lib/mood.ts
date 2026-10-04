import { type AnalysisResult, type MoodLabel, moodLabelOf } from '@thumbline/engine';
import type { Edits } from './song-store';

/** The four moods in plain words (engine-spec §4 mood). */
export const MOOD_OPTIONS = [
  { value: 'melancholic', label: 'Sad' },
  { value: 'warm', label: 'Warm' },
  { value: 'intense', label: 'Intense' },
  { value: 'upbeat', label: 'Happy' },
] as const satisfies ReadonlyArray<{ value: MoodLabel; label: string }>;

export const moodName = (m: MoodLabel) => MOOD_OPTIONS.find((o) => o.value === m)?.label ?? m;

/** What the song sounded like to us, if we could tell (songs read before M10 have no mood). */
export const detectedMood = (analysis: AnalysisResult): MoodLabel | undefined => (analysis.mood ? moodLabelOf(analysis.mood) : undefined);

/** The mood the sheet is arranged for: the user's choice, else what we heard. */
export const effectiveMood = (analysis: AnalysisResult, edits: Edits): MoodLabel | undefined => edits.mood ?? detectedMood(analysis);
