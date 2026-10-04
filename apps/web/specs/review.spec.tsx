import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AnalysisResult, ChordSegment } from '@thumbline/engine';
import axe from 'axe-core';
import { songStore } from '../src/lib/song-store';

const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace, prefetch: vi.fn() }) }));

const { default: Review } = await import('../src/app/review/page');

const seg = (bar: number, pc: number, quality: 'maj' | 'm', confidence = 0.6, beat = 0): ChordSegment => ({
  bar,
  beat,
  chord: { pc, quality },
  confidence,
  alternatives: [
    { pc: (pc + 9) % 12, quality: 'm' },
    { pc: (pc + 7) % 12, quality: 'maj' },
    { pc: (pc + 5) % 12, quality: 'maj' },
  ],
});

// 20 bars: G D Em C …, with bar 6 and bar 13 unsure, and a mid-bar change in bar 3.
const chords: ChordSegment[] = [];
const loop: Array<[number, 'maj' | 'm']> = [
  [7, 'maj'],
  [2, 'maj'],
  [4, 'm'],
  [0, 'maj'],
];
for (let bar = 0; bar < 20; bar++) {
  const [pc, q] = loop[bar % 4];
  chords.push(seg(bar, pc, q, bar === 5 || bar === 12 ? 0.05 : 0.6));
  if (bar === 2) chords.push(seg(2, 0, 'maj', 0.6, 2));
}
const analysis: AnalysisResult = {
  version: 1,
  durationSec: 60,
  bpm: 92.4,
  beatTimesSec: Array.from({ length: 81 }, (_, i) => 0.2 + i * 0.65),
  barStartBeat: 0,
  meter: { beatsPerBar: 4 },
  key: { pc: 7, mode: 'major' },
  chords,
};

/** jsdom has no Web Audio: a fake context that records what was played. */
type FakeSource = {
  buffer: unknown;
  onended: (() => void) | null;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};
const audio = { contexts: 0, sources: [] as FakeSource[], closed: 0, decoded: 0 };
class FakeAudioContext {
  destination = {};
  constructor() {
    audio.contexts++;
  }
  resume = () => Promise.resolve();
  close = () => {
    audio.closed++;
    return Promise.resolve();
  };
  decodeAudioData = () => {
    audio.decoded++;
    return Promise.resolve({ duration: 60 });
  };
  createBufferSource = () => {
    const source: FakeSource = {
      buffer: null,
      onended: null,
      start: vi.fn(),
      stop: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    audio.sources.push(source);
    return source;
  };
}
vi.stubGlobal('AudioContext', FakeAudioContext);

function load() {
  songStore.setState({ hydrated: true });
  songStore.getState().startSong(new File([new Uint8Array(4)], 'song.mp3', { type: 'audio/mpeg' }));
  songStore.getState().setAnalysis(analysis);
}

beforeEach(() => {
  push.mockClear();
  replace.mockClear();
  Object.assign(audio, { contexts: 0, sources: [], closed: 0, decoded: 0 });
  load();
});

const block = (bar: number) => screen.getByRole('button', { name: new RegExp(`(^|\\. )Bar ${bar} at `) });
const BLOCK = /(^|\. )Bar \d+ at /;
/** Press a play button and wait for the (asynchronously read and decoded) clip to start. */
async function startBar(name: string) {
  const count = audio.sources.length;
  const button = screen.getByRole('button', { name });
  fireEvent.click(button);
  await waitFor(() => expect(audio.sources).toHaveLength(count + 1));
  return button;
}
// jsdom has no :popover-open, so an open popover still counts as hidden and gets no
// accessible name; find the panel by its label (real browsers checked in the e2e run).
const panel = (label: string) => document.querySelector(`[role="dialog"][aria-label="${label}"]`) as HTMLElement;

describe('Review screen', () => {
  it('shows a page of 16 bars and counts the chords to check', () => {
    render(<Review />);
    expect(screen.getByRole('heading', { level: 1, name: 'Check the chords' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: BLOCK })).toHaveLength(16);
    expect(screen.getByText('2 chords to check')).toBeTruthy();
    expect(block(6).getAttribute('aria-label')).toBe('Bar 6 at 0:13: D, not sure, tap to choose');
    expect(block(2).getAttribute('aria-label')).toBe('Bar 2 at 0:02: D');
  });

  it('shows both chords of a bar that changes halfway', () => {
    render(<Review />);
    expect(block(3).getAttribute('aria-label')).toBe('Bar 3 at 0:05: Em · C');
  });

  it('offers the alternatives and records the choice', async () => {
    render(<Review />);
    await act(async () => fireEvent.click(block(6)));
    const dialog = panel('Pick a chord for bar 6');
    const options = within(dialog).getAllByRole('button', { hidden: true });
    expect(options.map((o) => o.getAttribute('aria-label'))).toEqual(['D, as heard', 'Bm', 'A', 'G']);
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: /^Bm/, hidden: true })));
    expect(songStore.getState().edits.chords[6]).toEqual({ pc: 11, quality: 'm' });
    expect(block(6).getAttribute('aria-label')).toBe('Bar 6 at 0:13: Bm, confirmed');
    expect(screen.getByText('1 chord to check')).toBeTruthy();
  });

  it('lists a picked alternative once, as the current chord', async () => {
    render(<Review />);
    await act(async () => fireEvent.click(block(6)));
    await act(async () => fireEvent.click(within(panel('Pick a chord for bar 6')).getByRole('button', { name: /^Bm/, hidden: true })));
    await act(async () => fireEvent.click(block(6)));
    const labels = within(panel('Pick a chord for bar 6'))
      .getAllByRole('button', { hidden: true })
      .map((o) => o.getAttribute('aria-label'));
    expect(labels).toEqual(['Bm, your choice', 'A', 'G']);
  });

  it('confirms an unsure chord as it is', async () => {
    render(<Review />);
    await act(async () => fireEvent.click(block(6)));
    const dialog = panel('Pick a chord for bar 6');
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: /^D, as heard/, hidden: true })));
    expect(block(6).getAttribute('aria-label')).toBe('Bar 6 at 0:13: D, confirmed');
  });

  it('pages through long songs', () => {
    render(<Review />);
    fireEvent.click(screen.getByRole('button', { name: 'Next bars' }));
    expect(screen.getByText('Bars 17 to 20 · 0:41–0:52')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: BLOCK })).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'Previous bars' }));
    expect(screen.getByText('Bars 1 to 16 · 0:00–0:41')).toBeTruthy();
  });

  it('shows tempo and key and lets the meter be changed', () => {
    render(<Review />);
    expect(screen.getByText('92 bpm')).toBeTruthy();
    expect(screen.getByText('G major')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: '3/4' }));
    expect(songStore.getState().edits.beatsPerBar).toBe(3);
  });

  it('moves on to the sheet', () => {
    render(<Review />);
    fireEvent.click(screen.getByRole('button', { name: 'Looks good, write my sheets' }));
    expect(push).toHaveBeenCalledWith('/sheet');
  });

  it('sends you back when there is nothing to review', () => {
    songStore.getState().clear();
    render(<Review />);
    expect(replace).toHaveBeenCalledWith('/');
  });

  it('sends you to Listen when the song is not analysed yet', () => {
    songStore.getState().startSong(new File([new Uint8Array(4)], 'song.mp3', { type: 'audio/mpeg' }));
    render(<Review />);
    expect(replace).toHaveBeenCalledWith('/listen');
  });

  it('letters repeated chord runs', () => {
    render(<Review />);
    expect(screen.getByText(/Letters mark runs of chords that repeat/)).toBeTruthy();
    expect(block(1).getAttribute('aria-label')).toBe('Section A starts. Bar 1 at 0:00: G');
    // Bars 9 to 16 repeat bars 1 to 8, give or take bar 3's change halfway.
    expect(block(9).getAttribute('aria-label')).toBe('Section A starts. Bar 9 at 0:21: G');
    expect(block(10).getAttribute('aria-label')).toBe('Bar 10 at 0:23: D');
  });

  it('leaves letters out when nothing repeats', () => {
    const distinct = Array.from({ length: 16 }, (_, bar) => seg(bar, bar % 12, bar < 12 ? 'maj' : 'm'));
    songStore.getState().setAnalysis({ ...analysis, chords: distinct });
    render(<Review />);
    expect(screen.queryByText(/Letters mark/)).toBeNull();
    expect(block(1).getAttribute('aria-label')).toBe('Bar 1 at 0:00: C');
  });

  it('plays a bar of the original clip, then stops it on a second press', async () => {
    render(<Review />);
    const play = await startBar('Play bar 5 (0:10)');
    expect(audio.contexts).toBe(1);
    const [when, offset, duration] = audio.sources[0].start.mock.calls[0] as number[];
    expect(when).toBe(0);
    // Bar 5 runs from beat 16 to beat 20: 0.2 + 16 × 0.65 s, for four beats.
    expect(offset).toBeCloseTo(10.6);
    expect(duration).toBeCloseTo(2.6);
    expect(play.getAttribute('aria-pressed')).toBe('true');
    expect(block(5).hasAttribute('data-playing')).toBe(true);

    await act(async () => fireEvent.click(play));
    expect(audio.sources[0].stop).toHaveBeenCalled();
    expect(play.getAttribute('aria-pressed')).toBe('false');
    expect(block(5).hasAttribute('data-playing')).toBe(false);
  });

  it('plays one bar at a time and decodes the clip once', async () => {
    render(<Review />);
    await startBar('Play bar 5 (0:10)');
    await startBar('Play bar 6 (0:13)');
    expect(audio.sources[0].stop).toHaveBeenCalled();
    expect(audio.decoded).toBe(1);
    expect(screen.getByRole('button', { name: 'Play bar 5 (0:10)' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Play bar 6 (0:13)' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('shows the bar as stopped when it reaches its end', async () => {
    render(<Review />);
    const play = await startBar('Play bar 2 (0:02)');
    await act(async () => audio.sources[0].onended?.());
    expect(play.getAttribute('aria-pressed')).toBe('false');
  });

  it('stops and closes the audio when you leave the page', async () => {
    const { unmount } = render(<Review />);
    await startBar('Play bar 5 (0:10)');
    unmount();
    expect(audio.sources[0].stop).toHaveBeenCalled();
    expect(audio.closed).toBe(1);
  });

  it('stops when the page is hidden', async () => {
    render(<Review />);
    const play = await startBar('Play bar 5 (0:10)');
    await act(async () => window.dispatchEvent(new Event('pagehide')));
    expect(audio.sources[0].stop).toHaveBeenCalled();
    expect(play.getAttribute('aria-pressed')).toBe('false');
  });

  it('has no axe violations', async () => {
    const { container } = render(<Review />);
    const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    expect(result.violations.map((v) => v.id)).toEqual([]);
  });
});
