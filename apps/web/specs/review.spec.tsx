import { act, fireEvent, render, screen, within } from '@testing-library/react';
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

function load() {
  songStore.setState({ hydrated: true });
  songStore.getState().startSong(new File([new Uint8Array(4)], 'song.mp3', { type: 'audio/mpeg' }));
  songStore.getState().setAnalysis(analysis);
}

beforeEach(() => {
  push.mockClear();
  replace.mockClear();
  load();
});

const block = (bar: number) => screen.getByRole('button', { name: new RegExp(`^Bar ${bar}:`) });
// jsdom has no :popover-open, so an open popover still counts as hidden and gets no
// accessible name; find the panel by its label (real browsers checked in the e2e run).
const panel = (label: string) => document.querySelector(`[role="dialog"][aria-label="${label}"]`) as HTMLElement;

describe('Review screen', () => {
  it('shows a page of 16 bars and counts the chords to check', () => {
    render(<Review />);
    expect(screen.getByRole('heading', { level: 1, name: 'Check the chords' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Bar \d+:/ })).toHaveLength(16);
    expect(screen.getByText('2 chords to check')).toBeTruthy();
    expect(block(6).getAttribute('aria-label')).toBe('Bar 6: D, not sure, tap to choose');
    expect(block(1).getAttribute('aria-label')).toBe('Bar 1: G');
  });

  it('shows both chords of a bar that changes halfway', () => {
    render(<Review />);
    expect(block(3).getAttribute('aria-label')).toBe('Bar 3: Em · C');
  });

  it('offers the alternatives and records the choice', async () => {
    render(<Review />);
    await act(async () => fireEvent.click(block(6)));
    const dialog = panel('Pick a chord for bar 6');
    const options = within(dialog).getAllByRole('button', { hidden: true });
    expect(options.map((o) => o.getAttribute('aria-label'))).toEqual(['D, as heard', 'Bm', 'A', 'G']);
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: /^Bm/, hidden: true })));
    expect(songStore.getState().edits.chords[6]).toEqual({ pc: 11, quality: 'm' });
    expect(block(6).getAttribute('aria-label')).toBe('Bar 6: Bm, confirmed');
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
    expect(block(6).getAttribute('aria-label')).toBe('Bar 6: D, confirmed');
  });

  it('pages through long songs', () => {
    render(<Review />);
    fireEvent.click(screen.getByRole('button', { name: 'Next bars' }));
    expect(screen.getByText('Bars 17 to 20')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Bar \d+:/ })).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'Previous bars' }));
    expect(screen.getByText('Bars 1 to 16')).toBeTruthy();
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

  it('has no axe violations', async () => {
    const { container } = render(<Review />);
    const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    expect(result.violations.map((v) => v.id)).toEqual([]);
  });
});
