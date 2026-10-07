import type { SectionSetting } from '@thumbline/engine';
import type { SongSection } from './sheet-view';

/** A section's own pattern and fullness; absent fields follow the song. */
export type SectionChoice = { patternId?: string; fullness?: number };
/** Saved choices: by letter ("letter:A", every repeat) or by first bar ("bar:16", that section only). */
export type SectionChoices = Record<string, SectionChoice>;

/** Where a section's choice is kept: its letter's (every repeat), or its own when asked or when it doesn't repeat. */
export const keyFor = (s: SongSection, onlyThis: boolean) => (onlyThis || !s.letter ? `bar:${s.firstBar}` : `letter:${s.letter}`);

/** A section's choice: its own first, then its letter's. */
export function choiceFor(s: SongSection, stored: SectionChoices | undefined): { key: string; onlyThis: boolean; choice?: SectionChoice } {
  const own = stored?.[keyFor(s, true)];
  if (own || !s.letter) return { key: keyFor(s, true), onlyThis: !!s.letter, choice: own };
  return { key: keyFor(s, false), onlyThis: false, choice: stored?.[keyFor(s, false)] };
}

/** The engine's section settings for the sheet's sections. */
export function toSectionSettings(sections: readonly SongSection[], stored: SectionChoices | undefined): SectionSetting[] {
  return sections.flatMap((s) => {
    const { choice } = choiceFor(s, stored);
    if (!choice || (choice.patternId === undefined && choice.fullness === undefined)) return [];
    return [{ fromBar: s.firstBar, toBar: s.firstBar + s.bars, ...choice }];
  });
}
