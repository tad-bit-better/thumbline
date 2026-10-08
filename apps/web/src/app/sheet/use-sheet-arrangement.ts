import {
  type AnalysisResult,
  type Arrangement,
  type Style,
  arrange,
  bestCapo,
  moodLabelOf,
  patternsFor,
} from '@thumbline/engine';
import { useEffect, useMemo } from 'react';
import { effectiveMood } from '../../lib/mood';
import { toSectionSettings } from '../../lib/section-settings';
import { sheetSections } from '../../lib/sheet-view';
import {
  type Edits,
  type SheetPrefs,
  effectiveAnalysis,
  songStore,
} from '../../lib/song-store';

/**
 * The song as the sheet plays it: the reader's edits applied, the style that
 * fits its meter, the mood, the patterns to choose from, the sections and their
 * settings, the capo kept since the sheet was first written, and the arrangement.
 */
export function useSheetArrangement(
  analysis: AnalysisResult | null,
  edits: Edits,
  prefs: SheetPrefs,
) {
  const effective = useMemo(
    () => (analysis ? effectiveAnalysis(analysis, edits) : null),
    [analysis, edits],
  );
  // Rumba and tangos are in 4/4: a song in 3/4 plays arpeggio instead.
  const flamencoOk = effective?.meter.beatsPerBar === 4;
  const style: Style =
    prefs.style === 'flamenco' && !flamencoOk ? 'arpeggio' : prefs.style;
  const palo = style === 'flamenco' ? prefs.palo : undefined;
  // The mood orders the patterns (the default is one that suits it) and sets the touch (M10).
  const moodValues = analysis ? effectiveMood(analysis, edits) : undefined;
  const mood = moodValues ? moodLabelOf(moodValues) : undefined;
  const patterns = useMemo(
    () =>
      effective
        ? patternsFor(
            style,
            prefs.level,
            effective.meter.beatsPerBar,
            palo,
            mood,
          )
        : [],
    [effective, style, prefs.level, palo, mood],
  );
  const pattern = patterns.length
    ? patterns[
        (prefs.pattern[`${style}.${prefs.level}`] ?? 0) % patterns.length
      ]
    : null;
  // Sections from the song's chords (A, B, A…), and the reader's pattern and fullness for them.
  const sections = useMemo(
    () => (effective ? sheetSections(effective) : []),
    [effective],
  );
  const sectionSettings = useMemo(
    () => toSectionSettings(sections, edits.sections),
    [sections, edits.sections],
  );
  // The capo the sheet was first written with stays when a chord changes (flamenco picks its own).
  const pinnedCapo = style === 'flamenco' ? undefined : edits.capo;
  const arrangement = useMemo<Arrangement | null>(() => {
    if (!effective || !pattern) return null;
    try {
      return arrange(effective, {
        style,
        level: prefs.level,
        patternId: pattern.id,
        palo,
        mood: moodValues,
        fullness: prefs.fullness,
        capo: pinnedCapo,
        sectionSettings,
      });
    } catch {
      return null;
    }
  }, [
    effective,
    style,
    prefs.level,
    pattern,
    palo,
    moodValues,
    prefs.fullness,
    pinnedCapo,
    sectionSettings,
  ]);
  useEffect(() => {
    if (arrangement && style !== 'flamenco' && edits.capo === undefined)
      songStore.getState().setCapo(arrangement.capo);
  }, [arrangement, style, edits.capo]);
  // After chord changes another capo may suit the song better: offered, never imposed.
  const betterCapo = useMemo(() => {
    if (!effective || pinnedCapo === undefined) return undefined;
    const best = bestCapo(
      effective.chords.flatMap((c) => (c.chord ? [c.chord] : [])),
    );
    return best !== pinnedCapo ? best : undefined;
  }, [effective, pinnedCapo]);

  return {
    effective,
    flamencoOk,
    style,
    palo,
    moodValues,
    mood,
    patterns,
    pattern,
    sections,
    arrangement,
    betterCapo,
  };
}
