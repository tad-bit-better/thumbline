import { act, fireEvent, render, screen } from '@testing-library/react';
import { AnalysisError, type Progress } from '@thumbline/audio-analysis';
import type { AnalysisResult } from '@thumbline/engine';
import { songStore } from '../src/lib/song-store';

const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace, prefetch: vi.fn() }) }));

type Run = { onProgress: (p: Progress) => void; signal: AbortSignal; resolve: (r: AnalysisResult) => void; reject: (e: unknown) => void };
const runs: Run[] = [];
vi.mock('../src/lib/analyze', () => ({
  analyze: (_file: File, onProgress: (p: Progress) => void, signal: AbortSignal) =>
    new Promise<AnalysisResult>((resolve, reject) => runs.push({ onProgress, signal, resolve, reject })),
}));

const { default: Listen } = await import('../src/app/listen/page');

const RESULT = { version: 1, bpm: 92, meter: { beatsPerBar: 4 }, chords: [], beatTimesSec: [], barStartBeat: 0, durationSec: 192, key: { pc: 7, mode: 'major' } } as AnalysisResult;
const last = () => runs[runs.length - 1];

beforeEach(() => {
  vi.useFakeTimers();
  push.mockClear();
  replace.mockClear();
  runs.length = 0;
  songStore.setState({ hydrated: true, uploadError: null, analysis: null });
  songStore.getState().startSong(new File([new Uint8Array(4)], 'wonderwall.mp3', { type: 'audio/mpeg' }));
});
afterEach(() => vi.useRealTimers());

describe('Listening screen', () => {
  it('reassures and shows the clip', () => {
    render(<Listen />);
    expect(screen.getByRole('heading', { name: 'Listening to your song' })).toBeTruthy();
    expect(screen.getByText(/runs on your device/)).toBeTruthy();
    expect(screen.getByText('wonderwall.mp3')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Progress' })).toBeTruthy();
  });

  it('walks through the steps with live details', () => {
    render(<Listen />);
    const step = (name: string) => screen.getByText(name).closest('li') as HTMLElement;
    act(() => last().onProgress({ step: 'decode', fraction: 0.05 }));
    expect(step('Decoding the audio').dataset['state']).toBe('active');
    act(() => last().onProgress({ step: 'key', fraction: 0.5, detail: { bpm: 92.4 } }));
    expect(step('Decoding the audio').dataset['state']).toBe('done');
    expect(step('Finding the beat').textContent).toContain('92 bpm');
    act(() => last().onProgress({ step: 'chords', fraction: 0.7, detail: { bar: 23, bars: 48 } }));
    expect(step('Finding the beat').dataset['state']).toBe('done');
    expect(step('Hearing the chords').textContent).toContain('bar 23 of 48');
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('70');
  });

  it('saves the result and moves on to Review', async () => {
    render(<Listen />);
    await act(async () => last().resolve(RESULT));
    expect(screen.getByText('Finding the beat').closest('li')?.textContent).toContain('92 bpm, 4/4');
    await act(async () => vi.advanceTimersByTime(1000));
    expect(songStore.getState().analysis).toBe(RESULT);
    expect(push).toHaveBeenCalledWith('/review');
  });

  it('sends clip problems back to Upload', async () => {
    render(<Listen />);
    await act(async () => last().reject(new AnalysisError('too-long', 'Clips can be up to 6 minutes long.')));
    expect(songStore.getState().uploadError).toBe('Clips can be up to 6 minutes long.');
    expect(replace).toHaveBeenCalledWith('/');
  });

  it('explains unexpected failures', async () => {
    render(<Listen />);
    await act(async () => last().reject(new Error('worker crashed')));
    expect(songStore.getState().uploadError).toMatch(/something went wrong/i);
    expect(replace).toHaveBeenCalledWith('/');
  });

  it('cancels back to Upload', () => {
    render(<Listen />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(last().signal.aborted).toBe(true);
    expect(push).toHaveBeenCalledWith('/');
  });

  it('goes back to Upload when there is no song', () => {
    songStore.getState().clear();
    render(<Listen />);
    expect(replace).toHaveBeenCalledWith('/');
    expect(runs).toHaveLength(0);
  });

  it('skips ahead when this song is already analysed', () => {
    songStore.getState().setAnalysis(RESULT);
    render(<Listen />);
    expect(replace).toHaveBeenCalledWith('/review');
  });
});
