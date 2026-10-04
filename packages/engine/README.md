# @thumbline/engine

Pure TypeScript: `AnalysisResult` + style + level → `Arrangement`. No DOM, Web Audio or React.
Contracts are in [docs/engine-spec.md](../../docs/engine-spec.md).

```ts
import { arrange } from '@thumbline/engine';

const sheet = arrange(analysis, { style: 'fingerstyle', level: 'moderate', capo: 'auto' });
```

| File | What it does |
|---|---|
| `chords.ts` | Parse and name chord symbols, chord tones, transpose |
| `voicings.ts` | Open-shape library, movable E/A shapes, Basic substitutions, root string |
| `capo.ts` | Capo optimiser (spec §4) |
| `bass.ts` | Alternate bass string |
| `runner.ts` | Applies a pattern to one chord; playability check |
| `patterns/` | Patterns as data, one file per style |
| `arrange.ts` | The main entry point |
| `testing/` | Test-only helpers (progression builder, ASCII tab for snapshots) |

## Adding a pattern

Add a `PatternDef` to `patterns/<style>.ts`. The pattern tests check its id, meters,
bar length and fingering, and the arrange tests run it over every snapshot progression.

## Commands

```bash
pnpm nx test @thumbline/engine    # tests + coverage (90% threshold)
pnpm nx lint @thumbline/engine
```
