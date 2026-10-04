import type { PatternDef } from '../types.js';

// Ticks: 480 = quarter, 240 = eighth, 120 = sixteenth.
// Strokes: rasgueo-down/up on 'all' strings (a strum); golpe is a tap on the top
// (the runner turns it into a pitchless note); 'scale' is the next note of a picado run.
// MUSIC-REVIEW: every pattern here is a first draft by a non-flamenco player:
// accents, which beats take the golpe, and the levels need a flamenco player's sign-off (M7 done-when).
// MUSIC-REVIEW: F (and other barre chords in E Phrygian) use the library's barre shape at Moderate and
// Advanced; flamenco players often keep the top strings open instead (F: 1-3-3-2-0-0).

export const FLAMENCO_PATTERNS: PatternDef[] = [
  {
    id: 'flamenco.basic.rumba',
    name: 'Rumba strum',
    hint: 'Thumb on the bass on 1 and 3; on 2 and 4 strum down with a golpe, then strum back up.',
    style: 'flamenco',
    level: 'basic',
    meters: [4],
    anchor: 'bar',
    palos: ['rumba'],
    events: {
      4: [
        { tick: 0, dur: 480, finger: 'p', target: 'bass', accent: true },
        { tick: 480, dur: 240, finger: 'i', target: 'all', tech: 'rasgueo-down', accent: true },
        { tick: 480, dur: 120, finger: 'a', target: 'all', tech: 'golpe' },
        { tick: 720, dur: 240, finger: 'i', target: 'all', tech: 'rasgueo-up' },
        { tick: 960, dur: 480, finger: 'p', target: 'bass' },
        { tick: 1440, dur: 240, finger: 'i', target: 'all', tech: 'rasgueo-down', accent: true },
        { tick: 1440, dur: 120, finger: 'a', target: 'all', tech: 'golpe' },
        { tick: 1680, dur: 240, finger: 'i', target: 'all', tech: 'rasgueo-up' },
      ],
    },
  },
  {
    id: 'flamenco.basic.tangos',
    name: 'Tangos strum',
    hint: 'A soft thumb note on 1, then strum down on 2, down and up on 3, and down with a golpe on 4.',
    style: 'flamenco',
    level: 'basic',
    meters: [4],
    anchor: 'bar',
    palos: ['tangos'],
    events: {
      4: [
        { tick: 0, dur: 480, finger: 'p', target: 'bass', velocity: 0.6 },
        { tick: 480, dur: 480, finger: 'i', target: 'all', tech: 'rasgueo-down', accent: true },
        { tick: 960, dur: 240, finger: 'i', target: 'all', tech: 'rasgueo-down' },
        { tick: 1200, dur: 240, finger: 'i', target: 'all', tech: 'rasgueo-up' },
        { tick: 1440, dur: 480, finger: 'i', target: 'all', tech: 'rasgueo-down', accent: true },
        { tick: 1440, dur: 120, finger: 'a', target: 'all', tech: 'golpe' },
      ],
    },
  },
  {
    id: 'flamenco.moderate.rumba',
    name: 'Rumba with golpe',
    hint: 'Strum down and up in eighths; the thumb takes the bass on 1 and 3, and a golpe lands with the down strum on 2 and 4.',
    style: 'flamenco',
    level: 'moderate',
    meters: [4],
    anchor: 'bar',
    palos: ['rumba'],
    events: {
      4: [
        { tick: 0, dur: 240, finger: 'p', target: 'bass', accent: true },
        { tick: 240, dur: 240, finger: 'i', target: 'all', tech: 'rasgueo-up' },
        { tick: 480, dur: 240, finger: 'i', target: 'all', tech: 'rasgueo-down', accent: true },
        { tick: 480, dur: 120, finger: 'a', target: 'all', tech: 'golpe' },
        { tick: 720, dur: 240, finger: 'i', target: 'all', tech: 'rasgueo-up' },
        { tick: 960, dur: 240, finger: 'p', target: 'bass' },
        { tick: 1200, dur: 240, finger: 'i', target: 'all', tech: 'rasgueo-up' },
        { tick: 1440, dur: 240, finger: 'i', target: 'all', tech: 'rasgueo-down', accent: true },
        { tick: 1440, dur: 120, finger: 'a', target: 'all', tech: 'golpe' },
        { tick: 1680, dur: 240, finger: 'i', target: 'all', tech: 'rasgueo-up' },
      ],
    },
  },
  {
    id: 'flamenco.moderate.tangos-alzapua',
    name: 'Alzapúa',
    hint: 'The thumb plays the bass, then strums down and back up through the strings; strum down with a golpe on 2 and 4.',
    style: 'flamenco',
    level: 'moderate',
    meters: [4],
    anchor: 'bar',
    palos: ['tangos'],
    events: {
      4: [
        { tick: 0, dur: 240, finger: 'p', target: 'bass', tech: 'apoyando', accent: true },
        { tick: 240, dur: 120, finger: 'p', target: 'all', tech: 'rasgueo-down' },
        { tick: 360, dur: 120, finger: 'p', target: 'all', tech: 'rasgueo-up' },
        { tick: 480, dur: 480, finger: 'i', target: 'all', tech: 'rasgueo-down', accent: true },
        { tick: 480, dur: 120, finger: 'a', target: 'all', tech: 'golpe' },
        { tick: 960, dur: 240, finger: 'p', target: 'bass', tech: 'apoyando' },
        { tick: 1200, dur: 120, finger: 'p', target: 'all', tech: 'rasgueo-down' },
        { tick: 1320, dur: 120, finger: 'p', target: 'all', tech: 'rasgueo-up' },
        { tick: 1440, dur: 480, finger: 'i', target: 'all', tech: 'rasgueo-down', accent: true },
        { tick: 1440, dur: 120, finger: 'a', target: 'all', tech: 'golpe' },
      ],
    },
  },
  {
    id: 'flamenco.advanced.rumba-rasgueado',
    name: 'Four-finger rasgueado',
    hint: 'Rumba strums with a golpe on 2, choked straight away with the palm (apagado); on 4 flick the little, ring, middle and index fingers down one after another.',
    style: 'flamenco',
    level: 'advanced',
    meters: [4],
    anchor: 'bar',
    palos: ['rumba'],
    events: {
      4: [
        { tick: 0, dur: 240, finger: 'p', target: 'bass', accent: true },
        { tick: 240, dur: 240, finger: 'i', target: 'all', tech: 'rasgueo-up' },
        { tick: 480, dur: 120, finger: 'i', target: 'all', tech: 'rasgueo-down', accent: true },
        { tick: 480, dur: 120, finger: 'a', target: 'all', tech: 'golpe' },
        { tick: 600, dur: 120, finger: 'p', target: 'all', tech: 'apagado' },
        { tick: 720, dur: 240, finger: 'i', target: 'all', tech: 'rasgueo-up' },
        { tick: 960, dur: 240, finger: 'p', target: 'bass' },
        { tick: 1200, dur: 240, finger: 'i', target: 'all', tech: 'rasgueo-up' },
        { tick: 1440, dur: 120, finger: 'c', target: 'all', tech: 'rasgueo-down', accent: true },
        { tick: 1560, dur: 120, finger: 'a', target: 'all', tech: 'rasgueo-down' },
        { tick: 1680, dur: 120, finger: 'm', target: 'all', tech: 'rasgueo-down' },
        { tick: 1800, dur: 120, finger: 'i', target: 'all', tech: 'rasgueo-down', accent: true },
      ],
    },
  },
  {
    id: 'flamenco.advanced.tangos-picado',
    name: 'Picado run',
    hint: 'Index and middle alternate rest strokes up the scale for two beats, then strum down with a golpe on 3 and 4.',
    style: 'flamenco',
    level: 'advanced',
    meters: [4],
    anchor: 'bar',
    palos: ['tangos'],
    events: {
      4: [
        { tick: 0, dur: 120, finger: 'p', target: 'bass', accent: true },
        { tick: 120, dur: 120, finger: 'i', target: 'scale', tech: 'apoyando' },
        { tick: 240, dur: 120, finger: 'm', target: 'scale', tech: 'apoyando' },
        { tick: 360, dur: 120, finger: 'i', target: 'scale', tech: 'apoyando' },
        { tick: 480, dur: 120, finger: 'm', target: 'scale', tech: 'apoyando', accent: true },
        { tick: 600, dur: 120, finger: 'i', target: 'scale', tech: 'apoyando' },
        { tick: 720, dur: 120, finger: 'm', target: 'scale', tech: 'apoyando' },
        { tick: 840, dur: 120, finger: 'i', target: 'scale', tech: 'apoyando' },
        { tick: 960, dur: 240, finger: 'i', target: 'all', tech: 'rasgueo-down', accent: true },
        { tick: 960, dur: 120, finger: 'a', target: 'all', tech: 'golpe' },
        { tick: 1200, dur: 240, finger: 'i', target: 'all', tech: 'rasgueo-up' },
        { tick: 1440, dur: 240, finger: 'i', target: 'all', tech: 'rasgueo-down', accent: true },
        { tick: 1440, dur: 120, finger: 'a', target: 'all', tech: 'golpe' },
        { tick: 1680, dur: 240, finger: 'i', target: 'all', tech: 'rasgueo-up' },
      ],
    },
  },
  {
    id: 'flamenco.advanced.tremolo',
    name: 'Tremolo',
    hint: 'Thumb on the bass, then ring, middle and index repeat the top note: p-a-m-i on every beat.',
    style: 'flamenco',
    level: 'advanced',
    meters: [4],
    anchor: 'bar',
    palos: ['rumba', 'tangos'],
    events: {
      4: [0, 1, 2, 3].flatMap((beat) => {
        const t = beat * 480;
        return [
          { tick: t, dur: 480, finger: 'p' as const, target: beat % 2 ? ('altBass' as const) : ('bass' as const), accent: beat === 0 },
          { tick: t + 120, dur: 120, finger: 'a' as const, target: 't1' as const, tech: 'tremolo' as const },
          { tick: t + 240, dur: 120, finger: 'm' as const, target: 't1' as const, tech: 'tremolo' as const },
          { tick: t + 360, dur: 120, finger: 'i' as const, target: 't1' as const, tech: 'tremolo' as const },
        ];
      }),
    },
  },
];
