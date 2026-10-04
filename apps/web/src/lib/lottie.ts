/**
 * The signature dotLottie moments (docs/design/motion.md), served from public/lottie.
 * Regenerate them with `node tools/make-lottie.mjs`.
 */
export const LOTTIE = {
  pickDrop: '/lottie/pick-drop.lottie',
  /** Authored at 60 bpm: play at speed = bpm / 60. */
  metronome: '/lottie/metronome.lottie',
  chordConfirmed: '/lottie/chord-confirmed.lottie',
  firstPlay: '/lottie/first-play.lottie',
  /** The player's renderer, from our own origin instead of a CDN. */
  wasm: '/lottie/dotlottie-player.wasm',
} as const;

export const METRONOME_AUTHORED_BPM = 60;
