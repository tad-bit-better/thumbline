/** A bar's place in the song's sections. */
export type BarSection = {
  /** "A", "B", …: phrases with the same letter repeat the same chord run. */
  letter: string;
  /** This bar is the first of a phrase (where the letter is shown). */
  starts: boolean;
};

/** Phrase lengths tried, longest first. */
const PHRASES = [8, 4] as const;

/** 0 → "A", 25 → "Z", 26 → "A2". */
function letterFor(i: number): string {
  const ch = String.fromCharCode(65 + (i % 26));
  return i < 26 ? ch : `${ch}${Math.floor(i / 26) + 1}`;
}

function differences(a: readonly string[], b: readonly string[]): number {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
  return n;
}

function label(bars: readonly string[], size: number): { sections: BarSection[]; repeats: boolean } {
  /** The first phrase given each letter: later phrases are compared with it, so matches don't drift. */
  const firsts: string[][] = [];
  const sections: BarSection[] = [];
  let repeats = false;
  for (let start = 0; start < bars.length; start += size) {
    const phrase = bars.slice(start, start + size);
    // A short last phrase is compared with the start of earlier ones; under half a phrase must match exactly.
    const allowed = phrase.length * 2 >= size ? 1 : 0;
    let best = -1;
    let bestDiff = Infinity;
    firsts.forEach((first, i) => {
      const diff = differences(phrase, first);
      if (diff <= allowed && diff < bestDiff) {
        best = i;
        bestDiff = diff;
      }
    });
    if (best >= 0) repeats = true;
    else {
      best = firsts.length;
      firsts.push(phrase);
    }
    const letter = letterFor(best);
    phrase.forEach((_, i) => sections.push({ letter, starts: i === 0 }));
  }
  return { sections, repeats };
}

/**
 * Letter repeated chord runs (A, B, A…), so a verse and a chorus stand out.
 * Bars are cut into phrases of 8 bars from the start of the song, or 4 if no
 * 8-bar phrase repeats. A phrase that matches an earlier one, give or take one
 * bar, takes its letter; otherwise it gets the next letter.
 *
 * @param bars one label per bar (e.g. its chord names); equal labels mean the same harmony.
 */
export function findSections(bars: readonly string[]): BarSection[] {
  let fallback: BarSection[] = [];
  for (const size of PHRASES) {
    const { sections, repeats } = label(bars, size);
    if (repeats) return sections;
    fallback = sections;
  }
  return fallback;
}

/** Some letter is used by more than one phrase. */
export function hasRepeats(sections: readonly BarSection[]): boolean {
  const seen = new Set<string>();
  for (const s of sections) {
    if (!s.starts) continue;
    if (seen.has(s.letter)) return true;
    seen.add(s.letter);
  }
  return false;
}
