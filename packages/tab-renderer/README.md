# @thumbline/tab-renderer

Draws an engine `Arrangement` as a tab: chord names, technique symbols, six strings (high e on top),
right-hand fingers and a playhead. Uses engine **types only** and UI kit tokens and motion.

```tsx
import '@thumbline/tab-renderer/styles.css';
import { TabSheet, ChordShapes, TabLegend } from '@thumbline/tab-renderer';

<TabSheet arrangement={sheet} width={containerWidth} cursorIndex={playingIndex} />
```

| File | What it does |
|---|---|
| `layout/layout.ts` | Pure layout: wraps 1–4 bars per system, places notes, chords, fingers and technique marks |
| `sheet/TabSheet.tsx` | SVG per system (memoised; only the playing system re-renders), reveal and playhead |
| `sheet/Techniques.tsx` | Slurs, accents, rasgueado arrows, golpe, pinch, apoyando, tremolo |
| `diagram/` | `ChordDiagram`, `ChordShapes` (shapes in order of appearance), `TabLegend` (only symbols in use) |
| `testing/` | Fixtures that call the real engine (tests and stories only) |

- Below one readable bar the sheet scrolls; the scroll region is focusable.
- Reveal replays when style, level or pattern changes and is skipped under reduced motion.
- Under reduced motion the playhead still moves but has no glow.
- 200 bars render in about 30 ms in Chromium (`Tab/TabSheet/Long song` story).
