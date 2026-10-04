# Design system

**Personality:** playful yet clean. A friendly music toy with the discipline of a good tool. Colour and motion reward actions; layouts stay calm and spacious.

## Colour

| Token | Value | Use |
|---|---|---|
| `--color-bg` | `#F3F1FA` | Page background (lavender-white) |
| `--color-surface` | `#FFFFFF` | Cards, panels, player bar |
| `--color-surface-sunken` | `#F3F1FA` | Segmented-control tracks, inputs |
| `--color-ink` | `#1E1A33` | Primary text |
| `--color-ink-2` | `#4A4560` | Secondary text |
| `--color-ink-3` | `#5E5A73` | Captions (min 4.5:1 on white) |
| `--color-line` | `#E2DEF0` | Borders, dividers |
| `--color-violet` | `#5B3BF5` | Primary actions, playhead, selected states |
| `--color-violet-deep` | `#3F23C9` | 3D button edge, pressed, links hover |
| `--color-violet-soft` | `#EDE9FF` | Selected backgrounds, bass notes |
| `--color-orange` | `#FF7A3D` | Accent: pick, low-confidence, highlights (never text on white) |
| `--color-orange-deep` | `#C73C08` | Orange 3D edge |
| `--color-orange-soft` | `#FFF1E8` | Low-confidence chord fill |
| `--color-mint` | `#14A386` | Success, confirmed |
| `--color-mint-deep` | `#0C6E5A` | Success text, 3D edge |
| `--color-mint-soft` | `#D8F7EF` | Completed steps |
| `--color-rose` | `#FF5C8A` | Flamenco accent, golpe |
| `--color-rose-deep` | `#B01E4E` | Rose text |
| `--color-rose-soft` | `#FFE0EA` | Golpe chip |
| `--color-string` | `#D3CCEC` | Tab strings |

Dark theme: deferred to v1.1. Keep every colour reference token-based so it's a token swap.

**Style colours:** Arpeggio = violet, Fingerstyle = mint, Flamenco = rose. Used for style icons and subtle accents only.

## Typography

- **UI:** Bricolage Grotesque (400, 600, 700, 800). Headlines 800 with tight tracking (−0.03 to −0.04em).
- **Data and tab:** IBM Plex Mono 500 (fret numbers, BPM, file names, timings).

| Token | Size / line-height | Use |
|---|---|---|
| `--text-display` | clamp(44px, 6.4vw, 76px) / 0.98 | Upload hero |
| `--text-h1` | clamp(32px, 4vw, 48px) / 1.0 | Screen titles |
| `--text-h2` | clamp(28px, 3.6vw, 42px) / 1.05 | Section titles |
| `--text-h3` | 19–24px / 1.2 | Card titles |
| `--text-body` | 16–17px / 1.5 | Body |
| `--text-small` | 14–15px / 1.45 | Hints, captions |
| `--text-mono` | 12–13px | Data |

## Shape and depth

- Radii: `--radius-sm` 10px (chips, segments), `--radius-md` 16px (buttons, chord blocks), `--radius-lg` 22px (small cards), `--radius-xl` 28–32px (main cards, drop zone).
- **3D press:** primary buttons have a solid bottom edge `0 4px 0 var(--color-violet-deep)`. Hover lifts 2px and the edge grows to 6px; active sinks 3px and the edge shrinks to 1px.
- **Card shadow:** `0 2px 0 var(--color-line), 0 24px 50px -30px rgba(77,52,190,.35)`. Soft, violet-tinted, never grey.
- Inset bottom shadows (`inset 0 -3px 0 …`) give badges and number chips a pressable feel.

## Spacing
4px base: 4, 8, 12, 16, 20, 24, 28, 32, 40, 56, 72, 96. Section gaps 72–96px on Upload; 16–28px inside app screens.

## 3D icons

A consistent "glossy toy" recipe, built as SVG components:
1. **Tile:** rounded square (rx ≈ 28% of size) with a vertical gradient, light at the top (style colour soft) to deep at the bottom.
2. **Gloss:** a white rounded rectangle at 18–22% opacity across the top third.
3. **Object:** the subject (pick, balls, fan, metronome) with a radial gradient, light source top-left (cx 35%, cy 28%).
4. **Specular:** one small white highlight stroke or dot on the object.
5. **Ground shadow:** blurred ellipse below in the deep colour at 25–30% opacity.

Set for v1: Pick, Metronome, Waveform tile, Arpeggio (rising balls), Fingerstyle (strings + pick), Flamenco (fan), Play sphere, Check badge, Upload arrow.
Interaction: tilt −8° and scale 1.06 on hover of the parent card (Bounce easing).
Upgrade path: render in Spline/Blender, export WebP @1x/2x or Lottie; keep the same silhouettes and light direction.

## Components (packages/ui)

| Component | Notes |
|---|---|
| `Button` | Variants: primary (violet 3D), secondary (sunken), ghost. Height 46–58px |
| `IconButton` | 44px min, `aria-label` required |
| `SegmentedControl` | Track in sunken colour; sliding pill (violet + 3D edge, or white for secondary); Bounce easing |
| `StyleCard` | 3D icon + title + hint; selected = 3px violet ring + lift |
| `Chip` | Pill, mono or sans |
| `Stepper` | Upload · Listen · Review · Play; done = mint soft, current = violet |
| `ProgressBar` | Rounded track with inset shadow; violet fill with moving shimmer |
| `ChordBlock` | Bar number, chord name, mini waveform; states: normal, low-confidence (orange ring + ping dot + gentle wiggle), open, confirmed (mint ring + tick) |
| `Popover` | White, 18px radius, pops from 92% scale |
| `PlayerBar` | Sticky, frosted white, play sphere, mix and speed segments |
| `LottieMoment` | dotLottie wrapper with fallback and reduced-motion still frame |

## Voice and copy
- Sentence case everywhere. Short, warm, concrete.
- Say what happens, not how: "Listening to your song", not "Running chord detection".
- Reassure on privacy once per screen where audio is involved.
- Set expectations: "We hear the chords and write a part for you to play."
- No exclamation marks except the first-full-play celebration ("Nice!").
