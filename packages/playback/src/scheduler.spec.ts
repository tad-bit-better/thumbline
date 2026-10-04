import { type Pass, createScheduler } from './scheduler.js';

/** Events at 0, 0.5, 1.0, … song seconds; song ends at `end`. */
function setup(count: number, end = count * 0.5) {
  return createScheduler({ eventSec: Array.from({ length: count }, (_, i) => i * 0.5), endSec: end });
}

function drain(s: ReturnType<typeof setup>, until: number, step = 0.025) {
  const notes: Array<{ eventIndex: number; when: number }> = [];
  const passes: Pass[] = [];
  let ended: number | null = null;
  for (let t = step; t <= until + 1e-9; t += step) {
    const r = s.advance(t);
    notes.push(...r.notes);
    passes.push(...r.passesStarted);
    if (r.endedAt !== null) ended = r.endedAt;
  }
  return { notes, passes, ended };
}

describe('scheduler', () => {
  it('schedules each event once at its audio time', () => {
    const s = setup(8);
    s.start(10, 0, 1);
    const { notes } = drain(s, 15);
    expect(notes.map((n) => n.eventIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    notes.forEach((n, i) => expect(n.when).toBeCloseTo(10 + i * 0.5));
  });

  it('only schedules inside the lookahead window', () => {
    const s = setup(8);
    s.start(0, 0, 1);
    expect(s.advance(0.6).notes.map((n) => n.eventIndex)).toEqual([0, 1]);
    expect(s.advance(0.6).notes).toEqual([]);
    expect(s.advance(1.01).notes.map((n) => n.eventIndex)).toEqual([2]);
  });

  it('starts from a song position', () => {
    const s = setup(8);
    s.start(0, 1.2, 1);
    const { notes } = drain(s, 3);
    expect(notes[0]).toMatchObject({ eventIndex: 3 });
    expect(notes[0].when).toBeCloseTo(0.3);
  });

  it('plays slower at a lower ratio', () => {
    const s = setup(4);
    s.start(0, 0, 0.5);
    const { notes } = drain(s, 5);
    expect(notes.map((n) => n.when)).toEqual([0, 1, 2, 3].map((i) => expect.closeTo(i, 6)));
  });

  it('changes tempo mid-play at the end of what is already scheduled', () => {
    const s = setup(8);
    s.start(0, 0, 1);
    s.advance(1.1); // events 0..2 scheduled, up to 1.1
    s.setRatio(0.5);
    const r = s.advance(10);
    // song 1.1 is reached at audio 1.1; event 3 (song 1.5) is 0.4 song-s later at half speed
    expect(r.notes[0]).toMatchObject({ eventIndex: 3, when: expect.closeTo(1.1 + 0.8, 6) });
    expect(r.passesEnded[0]).toMatchObject({ audioEnd: expect.closeTo(1.1, 6) });
    expect(r.passesStarted[0]).toMatchObject({ audioStart: expect.closeTo(1.1, 6), songStart: expect.closeTo(1.1, 6), ratio: 0.5 });
  });

  it('loops a range, starting a new pass at each boundary', () => {
    const s = setup(8);
    s.setLoop({ startSec: 1, endSec: 2 });
    s.start(0, 1, 1);
    const { notes, passes } = drain(s, 3.05);
    expect(notes.map((n) => n.eventIndex)).toEqual([2, 3, 2, 3, 2, 3, 2]);
    expect(passes.map((p) => p.audioStart)).toEqual([0, 1, 2, 3].map((x) => expect.closeTo(x, 6)));
    expect(passes.every((p) => p.songStart === 1 && p.songEnd === 2)).toBe(true);
  });

  it('jumps into a new loop that excludes the current position', () => {
    const s = setup(8);
    s.start(0, 0, 1);
    s.advance(0.6);
    s.setLoop({ startSec: 2, endSec: 3 });
    const r = s.advance(0.7);
    expect(r.passesStarted[0]).toMatchObject({ audioStart: expect.closeTo(0.6, 6), songStart: 2 });
    expect(r.notes[0]).toMatchObject({ eventIndex: 4, when: expect.closeTo(0.6, 6) });
  });

  it('clears a loop and plays on to the end', () => {
    const s = setup(8);
    s.setLoop({ startSec: 0, endSec: 1 });
    s.start(0, 0, 1);
    s.advance(0.5);
    s.setLoop(null);
    const { notes, ended } = drain(s, 6);
    expect(notes.map((n) => n.eventIndex)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(ended).toBeCloseTo(4);
  });

  it('reports the end of the song once', () => {
    const s = setup(2, 1.5);
    s.start(0, 0, 1);
    expect(s.advance(1).endedAt).toBeNull();
    expect(s.advance(2).endedAt).toBeCloseTo(1.5);
    expect(s.advance(3).endedAt).toBeNull();
  });

  it('maps audio time back to song time', () => {
    const s = setup(8);
    s.start(5, 1, 0.5);
    s.advance(6);
    expect(s.songSecAt(6)).toBeCloseTo(1.5);
  });

  describe('sync with the original over 3 minutes', () => {
    it('keeps every note on the recording, through tempo changes and loops', () => {
      // Beats drift ±4% around 92 bpm; events every eighth for 3 minutes.
      const eventSec: number[] = [];
      let t = 0.37;
      while (t < 180) {
        eventSec.push(t);
        t += (60 / 92 / 2) * (1 + 0.04 * Math.sin(eventSec.length / 37));
      }
      const s = createScheduler({ eventSec, endSec: t });
      s.start(2, 0, 1);
      const live: Pass[] = [];
      let maxError = 0;
      for (let now = 2; now < 2 + 360; now += 0.025) {
        if (Math.abs(now - 40) < 0.0125) s.setRatio(0.75);
        if (Math.abs(now - 90) < 0.0125) s.setLoop({ startSec: 60, endSec: 70 });
        if (Math.abs(now - 150) < 0.0125) s.setRatio(0.5);
        if (Math.abs(now - 200) < 0.0125) s.setLoop(null);
        if (Math.abs(now - 230) < 0.0125) s.setRatio(1);
        const r = s.advance(now + 0.12);
        live.push(...r.passesStarted);
        for (const n of r.notes) {
          // The original (stretched by the pass ratio) plays song second
          // songStart + (when - audioStart) * ratio at the note's audio time.
          const pass = [...live].reverse().find((p) => p.audioStart <= n.when + 1e-9) as Pass;
          const heard = pass.songStart + (n.when - pass.audioStart) * pass.ratio;
          maxError = Math.max(maxError, Math.abs(heard - eventSec[n.eventIndex]));
        }
      }
      expect(maxError).toBeLessThan(1e-6);
    });
  });
});
