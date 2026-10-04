import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AnalysisResult } from '@thumbline/engine';
import { ToastProvider } from '@thumbline/ui';
import axe from 'axe-core';
import { songStore } from '../src/lib/song-store';

const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace, prefetch: vi.fn() }) }));

type Opts = { onCursor: (i: number) => void; onEnd?: () => void; onStateChange?: (s: string) => void; arrangement: { patternId: string } };
const players: Array<Record<string, ReturnType<typeof vi.fn>> & { opts: Opts }> = [];
vi.mock('@thumbline/playback', () => ({
  createPlayer: (opts: Opts) => {
    const p = {
      opts,
      play: vi.fn(async () => opts.onStateChange?.('playing')),
      stop: vi.fn(() => opts.onStateChange?.('idle')),
      setMix: vi.fn(),
      setTempoRatio: vi.fn(async () => undefined),
      setLoop: vi.fn(),
      dispose: vi.fn(),
    };
    players.push(p);
    return p;
  },
}));

class FakeAudioContext {
  sampleRate = 44100;
  decodeAudioData = vi.fn(async () => ({ duration: 20, numberOfChannels: 1, length: 1, sampleRate: 44100, getChannelData: () => new Float32Array(1) }));
  resume = vi.fn(async () => undefined);
  close = vi.fn(async () => undefined);
}
vi.stubGlobal('AudioContext', FakeAudioContext);

const { default: SheetPage } = await import('../src/app/sheet/page');
// As in the app layout: toasts come from the provider.
const Sheet = () => (
  <ToastProvider>
    <SheetPage />
  </ToastProvider>
);

const loop: Array<[number, 'maj' | 'm']> = [
  [7, 'maj'],
  [2, 'maj'],
  [4, 'm'],
  [0, 'maj'],
];
const analysis: AnalysisResult = {
  version: 1,
  durationSec: 30,
  bpm: 92,
  beatTimesSec: Array.from({ length: 33 }, (_, i) => 0.2 + i * 0.65),
  barStartBeat: 0,
  meter: { beatsPerBar: 4 },
  key: { pc: 7, mode: 'major' },
  chords: Array.from({ length: 8 }, (_, bar) => ({ bar, beat: 0, chord: { pc: loop[bar % 4][0], quality: loop[bar % 4][1] }, confidence: 0.8, alternatives: [] })),
};

/** Press Play and wait until the player is running (decoding is async). */
async function startPlaying() {
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy());
}

beforeEach(() => {
  push.mockClear();
  replace.mockClear();
  players.length = 0;
  songStore.setState({ hydrated: true });
  songStore.getState().startSong(new File([new Uint8Array(4)], 'wonderwall.mp3', { type: 'audio/mpeg' }));
  songStore.getState().setAnalysis(analysis);
  songStore.setState({ prefs: { style: 'arpeggio', level: 'basic', pattern: {}, mix: 'both', speed: 1 } });
});

describe('Sheet screen', () => {
  it('shows the song, capo and key', () => {
    render(<Sheet />);
    expect(screen.getByRole('heading', { level: 1, name: 'Your sheet' })).toBeTruthy();
    expect(screen.getByText('wonderwall.mp3')).toBeTruthy();
    expect(screen.getByText('No capo needed')).toBeTruthy();
    expect(screen.getByText('G major, 4/4')).toBeTruthy();
  });

  it('draws the tab, the chord shapes and a legend', () => {
    render(<Sheet />);
    expect(screen.getByRole('region', { name: 'Arpeggio tab' })).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Chord shapes' })).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Legend' })).toBeTruthy();
  });

  it('switches style and level, and describes the pattern', () => {
    render(<Sheet />);
    expect(screen.getByText('Simple roll')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Fingerstyle' }));
    expect(songStore.getState().prefs.style).toBe('fingerstyle');
    expect(screen.getByText('Thumb and pluck')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Moderate' }));
    expect(screen.getByText('Travis picking')).toBeTruthy();
  });

  it('offers another pattern at the same level', () => {
    render(<Sheet />);
    fireEvent.click(screen.getByRole('button', { name: 'Try another pattern' }));
    expect(screen.getByText('Slow roll')).toBeTruthy();
  });

  it('keeps flamenco for later', () => {
    render(<Sheet />);
    expect((screen.getByRole('radio', { name: 'Flamenco' }) as HTMLInputElement).disabled).toBe(true);
  });

  it('plays with the original on one context and moves the playhead', async () => {
    const { container } = render(<Sheet />);
    await startPlaying();
    expect(players).toHaveLength(1);
    expect(players[0].play).toHaveBeenCalled();
    expect(players[0].setMix).toHaveBeenCalledWith('both');
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    act(() => players[0].opts.onCursor(3));
    expect(container.querySelector('[data-playhead]')).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Pause' })));
    expect(players[0].stop).toHaveBeenCalled();
  });

  it('passes mix, speed and loop to the player', async () => {
    render(<Sheet />);
    await startPlaying();
    fireEvent.click(screen.getByRole('radio', { name: 'Sheet' }));
    expect(players[0].setMix).toHaveBeenLastCalledWith('sheet');
    await act(async () => fireEvent.click(screen.getByRole('radio', { name: '75%' })));
    expect(players[0].setTempoRatio).toHaveBeenLastCalledWith(0.75);
    fireEvent.click(screen.getByRole('button', { name: 'Loop' }));
    expect(players[0].setLoop).toHaveBeenLastCalledWith(0, 7);
    expect(songStore.getState().prefs).toMatchObject({ mix: 'sheet', speed: 0.75 });
  });

  it('rebuilds the player when the arrangement changes', async () => {
    render(<Sheet />);
    await startPlaying();
    fireEvent.click(screen.getByRole('radio', { name: 'Advanced' }));
    expect(players[0].dispose).toHaveBeenCalled();
  });

  it('celebrates the first full play', async () => {
    render(<Sheet />);
    await startPlaying();
    act(() => players[0].opts.onEnd?.());
    expect(screen.getByRole('status').textContent).toContain('Nice!');
  });

  it('has keyboard shortcuts', async () => {
    render(<Sheet />);
    fireEvent.keyDown(window, { key: ' ' });
    await waitFor(() => expect(players[0]?.play).toHaveBeenCalled());
    fireEvent.keyDown(window, { key: '3' });
    expect(songStore.getState().prefs.level).toBe('advanced');
    fireEvent.keyDown(window, { key: 'l' });
    expect(screen.getByRole('button', { name: 'Loop' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('starts a new song after confirming', async () => {
    render(<Sheet />);
    fireEvent.click(screen.getByRole('button', { name: 'New song' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
    expect(songStore.getState().meta).toBeNull();
    expect(push).toHaveBeenCalledWith('/');
  });

  it('sends you back without a song', () => {
    songStore.getState().clear();
    render(<Sheet />);
    expect(replace).toHaveBeenCalledWith('/');
  });

  it('has no axe violations', async () => {
    const { container } = render(<Sheet />);
    const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    expect(result.violations.map((v) => v.id)).toEqual([]);
  });
});
