# Motion

Motion explains what happened, keeps context across screens, and adds a little joy at the right moments. If an animation doesn't do one of those, cut it.

## Tokens

| Token | Duration | Easing | Use |
|---|---|---|---|
| `--motion-snap` | 160ms | `cubic-bezier(.2,.9,.3,1.3)` | Button press, chip select, hover lift |
| `--motion-glide` | 280ms | `cubic-bezier(.3,.7,.3,1)` | Fades, panels, screen fades |
| `--motion-bounce` | 340–420ms | `cubic-bezier(.2,.9,.3,1.4)` | Pill slide, popovers, icon tilt, ticks |
| `--motion-reveal` | 400ms + 14ms stagger | `cubic-bezier(.2,.9,.3,1.35)` | Notes popping in |

In `motion/react`, the springy curves map to `type: "spring", stiffness: 500, damping: 28` (snap) and `stiffness: 380, damping: 22` (bounce).

## The eight signature moments (dotLottie)

| # | Name | Trigger | Length | Loop | Notes for the animator |
|---|---|---|---|---|---|
| 1 | Pick drop | File accepted on Upload | 700ms | once | Pick falls from above, squashes (1.18 × 0.82), rebounds, settles. Shadow grows on impact |
| 2 | Listening loop | During analysis | 1.1s | yes | 7 bars breathing out of phase; one orange, one mint. Optionally driven by real RMS |
| 3 | Metronome | Listening screen, after BPM found | 60/bpm per swing | yes | Arm swings ±22–24°, weight orange. Speed set from detected tempo |
| 4 | Chord confirmed | User picks an alternative | 450ms | once | Mint ring bursts outward and fades; tick badge pops in with overshoot |
| 5 | Sheet reveal | Style or level change | 400ms + stagger | once | Implemented in code (`Reveal`), not Lottie: notes scale 0 → 1.25 → 1 left to right |
| 6 | Level switch | Level segmented control | 340ms | once | In code (`motion` layout animation): pill slides with slight overshoot, then triggers #5 |
| 7 | Playhead glow | During playback | synced | yes | In code: 4px violet line with a soft 28px halo; notes brighten as it passes |
| 8 | First full play | Sheet played to the end the first time | 1.2s | once per sheet | Picks, dots and notes burst upward in brand colours; "Nice!" |

Lottie deliverables: #1, #3, #4, #8 as `.lottie` files in `apps/web/public/lottie/`, each under 60 KB, 60fps, using only brand colours (themeable via dotLottie theming where possible). They're built from code by `tools/make-lottie.mjs` (geometry from the 3D icons, colours from the tokens), so a change is a code review, not a file swap. #2 stays in CSS: the Listening screen's 28-bar wave already is the listening loop, and a Lottie version would only add the player's download. #5–#7 stay in code so they can sync with state.

The player's WASM renderer is served from our origin (`/lottie/dotlottie-player.wasm`, copied by the same script); by default it would load from a public CDN. Warm it while the Upload page is idle so the Pick drop starts at once; a one-shot that hasn't finished after 2 s completes anyway, so no flow waits on it.

## Component transitions
- **Buttons:** hover lift 2px (snap), press sink 3px (snap).
- **Cards:** hover lift 6px with −0.6° rotation; icon inside tilts −8° (bounce).
- **Popover:** from 92% scale and 8px down, origin at the trigger (bounce).
- **Low-confidence chord:** ping dot every 1.4s and a ±2° wiggle every 2.4s until resolved.
- **Progress bar:** width eases with glide; shimmer sweeps every 1.6s.
- **Step list:** each row rises 14px and fades in, 200ms apart; ticks pop in.

## Screen transitions (View Transitions API)
- **Upload → Listening:** the drop zone card morphs into the listening card (`view-transition-name: main-card`).
- **Listening → Review:** progress card fades out; chord grid blocks rise in with stagger.
- **Review → Sheet:** chord blocks morph into the chord labels on the sheet (shared names per bar for the first 8 bars).
- Fallback where unsupported: 200ms cross-fade.

## Performance rules
- Animate `transform` and `opacity` only (progress width excepted).
- Lazy-load Lottie files when their screen mounts; preload Pick drop after first interaction on Upload.
- At most 60 staggered elements; beyond that, reveal per system.
- Pause loops when the tab is hidden (`document.visibilityState`).

## Reduced motion
- Loops stop; Lottie shows a designed still frame.
- Screen morphs become 120ms fades; reveals become instant.
- The playhead still moves (it carries information) but without the glow.
- Confetti is skipped; the "Nice!" toast still appears.
