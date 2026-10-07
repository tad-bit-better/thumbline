'use client';

import {
  Button,
  Checkbox,
  Chip,
  Popover,
  RadioList,
  Slider,
} from '@thumbline/ui';
import { useEffect, useRef, useState } from 'react';
import {
  type SectionChoice,
  type SectionChoices,
  choiceFor,
  keyFor,
} from '../../lib/section-settings';
import type { SongSection } from '../../lib/sheet-view';
import styles from './sheet.module.css';

/** How long the section's fullness slider rests before the sheet re-arranges (a debounce, not an animation). */
const SETTLE_MS = 300;

export type SectionEditorProps = {
  section: SongSection;
  /** Every section, to count this one's repeats. */
  sections: readonly SongSection[];
  stored: SectionChoices | undefined;
  /** The current style and level's patterns. */
  patterns: ReadonlyArray<{ id: string; name: string }>;
  /** The song's own fullness (what "Same as the song" means). */
  songFullness: number;
  onChange: (key: string, choice: SectionChoice | null) => void;
};

/**
 * "Edit section" beside a section heading: its own pattern and fullness, for
 * every repeat of its letter or (asked) only this one, and Reset. A section
 * with a choice of its own says "Custom".
 */
export function SectionEditor({
  section,
  sections,
  stored,
  patterns,
  songFullness,
  onChange,
}: SectionEditorProps) {
  const { key, onlyThis, choice } = choiceFor(section, stored);
  const repeats = section.letter
    ? sections.filter((s) => s.letter === section.letter).length
    : 1;
  const [draft, setDraft] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const set = (next: SectionChoice) => {
    const clean: SectionChoice = {
      ...(next.patternId !== undefined ? { patternId: next.patternId } : {}),
      ...(next.fullness !== undefined ? { fullness: next.fullness } : {}),
    };
    onChange(key, Object.keys(clean).length ? clean : null);
  };
  const fullness = draft ?? choice?.fullness ?? songFullness;
  const custom =
    choice?.patternId !== undefined || choice?.fullness !== undefined;
  const name = section.letter
    ? `section ${section.letter}`
    : section.title.toLowerCase();

  return (
    <span className={styles.sectionActions}>
      {custom && <Chip tone="violet">Custom</Chip>}
      <Popover
        label={`Settings for ${section.title}`}
        className={styles.sectionPanel}
        onOpenChange={setOpen}
        trigger={({ ref, ...props }) => (
          <Button
            variant="ghost"
            ref={ref as (el: HTMLButtonElement | null) => void}
            {...props}
            aria-label={`Edit ${name}, ${section.detail ?? ''}`}
          >
            Edit section
          </Button>
        )}
      >
        {open && (
          <div className={styles.sectionOptions}>
            <p className={styles.optionLabel}>
              {section.title} · {section.detail}
            </p>
            <p className={styles.optionLabel}>Pattern</p>
            <RadioList
              label="Pattern"
              options={[
                { value: '', label: 'Auto', hint: 'As the rest of the song' },
                ...patterns.map((p) => ({ value: p.id, label: p.name })),
              ]}
              value={choice?.patternId ?? ''}
              onChange={(id) => set({ ...choice, patternId: id || undefined })}
            />
            <p className={styles.optionLabel}>Fullness</p>
            <Checkbox
              label={`Same as the song (${songFullness})`}
              checked={choice?.fullness === undefined}
              onChange={(same) =>
                set({ ...choice, fullness: same ? undefined : songFullness })
              }
            />
            {choice?.fullness !== undefined && (
              <Slider
                label={`Fullness: ${fullness} of 10`}
                minLabel="Sparse"
                maxLabel="Full"
                value={(fullness - 1) / 9}
                step={1 / 9}
                valueText={(v) => `${Math.round(1 + v * 9)} of 10`}
                onChange={(v) => {
                  const f = Math.round(1 + v * 9);
                  setDraft(f);
                  clearTimeout(timer.current);
                  timer.current = setTimeout(() => {
                    set({ ...choice, fullness: f });
                    setDraft(null);
                  }, SETTLE_MS);
                }}
              />
            )}
            {repeats > 1 && (
              <Checkbox
                label={`Only this one (${section.detail?.toLowerCase()}), not all ${repeats} ${section.letter}s`}
                checked={onlyThis}
                onChange={(only) => {
                  if (only)
                    onChange(
                      keyFor(section, true),
                      choice ?? stored?.[keyFor(section, false)] ?? {},
                    );
                  else onChange(keyFor(section, true), null);
                }}
              />
            )}
            {custom && (
              <Button variant="ghost" onClick={() => onChange(key, null)}>
                Reset {name}
              </Button>
            )}
          </div>
        )}
      </Popover>
    </span>
  );
}
