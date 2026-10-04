# @thumbline/playback

Plays an engine `Arrangement` with a nylon-guitar synth, optionally alongside the original recording,
on one Web Audio clock. Uses engine **types only**; no network access.

```ts
import { createPlayer } from '@thumbline/playback';

const player = createPlayer({ arrangement, original, beats, onCursor: setCursorIndex, onEnd });
await player.play();
player.setMix('both');
await player.setTempoRatio(0.75); // original is time-stretched, pitch unchanged
player.setLoop(4, 7);
```

| File | What it does |
|---|---|
| `timeline.ts` | Ticks ↔ seconds in the recording, following its detected beats |
| `scheduler.ts` | Pure lookahead scheduler built on passes (loop passes, tempo changes) |
| `synth.ts` | In-tune Karplus-Strong nylon pluck, golpe burst, rasgueado stagger, note gains |
| `stretch.ts` | WSOLA time-stretch (sync and yielding async) |
| `player.ts` | Web Audio wiring: buses, per-string damping, original passes, latency-compensated cursor |

Sync: in each pass a note at song time `s` plays at `audioStart + (s − songStart) / ratio`, and the
original starts at `songStart / ratio` in its stretched copy — same clock, same formula, no drift.
Tests run the core in Node and the player against a fake `AudioContext` (`src/testing/fake-audio.ts`).
