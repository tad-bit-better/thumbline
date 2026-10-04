/**
 * A pass is a stretch of playback where song time moves linearly:
 * audio time = audioStart + (songSec - songStart) / ratio.
 * The original recording is started per pass with the same anchor,
 * so notes and recording share one clock and cannot drift.
 */
export type Pass = { id: number; audioStart: number; songStart: number; songEnd: number; ratio: number };

export type Loop = { startSec: number; endSec: number };

export type Advance = {
  notes: Array<{ eventIndex: number; when: number }>;
  passesStarted: Pass[];
  passesEnded: Array<{ id: number; audioEnd: number }>;
  /** Audio time the song ends, reported once. */
  endedAt: number | null;
};

export type Scheduler = {
  start: (audioTime: number, songSec: number, ratio: number) => Pass;
  /** Takes effect at the end of what is already scheduled. */
  setRatio: (ratio: number) => void;
  setLoop: (loop: Loop | null) => void;
  /** Schedule everything that starts before `until` (audio seconds). */
  advance: (until: number) => Advance;
  songSecAt: (audioTime: number) => number;
};

/** Pure lookahead scheduler over event times in song seconds (sorted). */
export function createScheduler({ eventSec, endSec }: { eventSec: readonly number[]; endSec: number }): Scheduler {
  let loop: Loop | null = null;
  let pass: Pass | null = null;
  let nextIndex = 0;
  let scheduledUntil = 0;
  let ratio = 1;
  let pending = false;
  let ids = 0;
  let started: Pass[] = [];

  const firstAtOrAfter = (sec: number) => {
    let lo = 0;
    let hi = eventSec.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (eventSec[mid] < sec - 1e-9) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  const begin = (audioStart: number, songSec: number, r: number, out: Pass[]) => {
    let songStart = songSec;
    if (loop && (songStart < loop.startSec || songStart >= loop.endSec)) songStart = loop.startSec;
    pass = { id: ++ids, audioStart, songStart, songEnd: loop ? loop.endSec : endSec, ratio: r };
    nextIndex = firstAtOrAfter(songStart);
    out.push(pass);
    return pass;
  };

  const songSecAt = (audioTime: number) => {
    if (!pass) return 0;
    return pass.songStart + (audioTime - pass.audioStart) * pass.ratio;
  };

  return {
    start(audioTime, songSec, r) {
      ratio = r;
      pending = false;
      scheduledUntil = audioTime;
      started = [];
      return begin(audioTime, songSec, r, started);
    },
    setRatio(r) {
      ratio = r;
      pending = true;
    },
    setLoop(l) {
      loop = l;
      pending = true;
    },
    songSecAt,
    advance(until) {
      const out: Advance = { notes: [], passesStarted: started, passesEnded: [], endedAt: null };
      started = [];
      if (!pass) return out;

      if (pending) {
        pending = false;
        const at = scheduledUntil;
        out.passesEnded.push({ id: pass.id, audioEnd: at });
        begin(at, songSecAt(at), ratio, out.passesStarted);
      }

      for (;;) {
        const p: Pass = pass;
        if (nextIndex < eventSec.length && eventSec[nextIndex] < p.songEnd) {
          const when = p.audioStart + (eventSec[nextIndex] - p.songStart) / p.ratio;
          if (when >= until) break;
          out.notes.push({ eventIndex: nextIndex, when });
          nextIndex++;
          continue;
        }
        const audioEnd = p.audioStart + (p.songEnd - p.songStart) / p.ratio;
        if (audioEnd >= until) break;
        out.passesEnded.push({ id: p.id, audioEnd });
        if (loop) {
          begin(audioEnd, loop.startSec, p.ratio, out.passesStarted);
          continue;
        }
        out.endedAt = audioEnd;
        pass = null;
        break;
      }
      scheduledUntil = Math.max(scheduledUntil, until);
      return out;
    },
  };
}
