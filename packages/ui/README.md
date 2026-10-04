# @thumbline/ui

Design system: tokens, components, 3D icons, motion primitives and the dotLottie wrapper.
No music logic. Specs: [design-system.md](../../docs/design/design-system.md), [motion.md](../../docs/design/motion.md).

```tsx
import '@thumbline/ui/tokens.css';
import '@thumbline/ui/styles.css';
import { Button, SegmentedControl, StyleCard, ReducedMotionProvider } from '@thumbline/ui';
```

| Folder | What's in it |
|---|---|
| `src/styles/tokens.css` | Colour, type, shape, depth, spacing and motion tokens (single source) |
| `src/components` | Button, IconButton, SegmentedControl, Chip, Card, StyleCard, Stepper, ProgressBar, Toast, Popover, Dialog, flat glyphs |
| `src/icons3d` | Glossy 3D SVG icons built from one recipe (`recipe.tsx`) |
| `src/motion` | `Reveal`, `PressScale`, `Pulse`, `useReducedMotion`, spring presets and loop timings |
| `src/lottie` | `LottieMoment`: lazy dotLottie player with a still-frame fallback |

## Rules

- Every colour, radius, shadow, duration and easing comes from `tokens.css`.
- Animated components read `useReducedMotion()` and set `data-reduced-motion`; their CSS turns motion off under it.
- Interactive targets are at least 44px (chips extend their hit area with a pseudo element).
- Overlays use the native `<dialog>` and Popover API, so focus, Escape and the top layer come from the browser.

## Stories

Each component has stories for default, hover, focus, disabled and reduced motion. Use the toolbar's
**Motion** menu to force reduced motion. Hover stories wrap the component in `data-force-state="hover"`.

```bash
pnpm nx storybook @thumbline/ui
pnpm nx test @thumbline/ui     # unit tests with axe-core
```
