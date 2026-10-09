import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AnalysisResult } from '@thumbline/engine';
import { ToastProvider } from '@thumbline/ui';
import axe from 'axe-core';
import { songStore } from '../src/lib/song-store';

const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace, prefetch: vi.fn() }) }));

type Opts = { onCursor: (i: number) => void; onEnd?: () => void; onStateChange?: (s: string) => void; arrangement: { patternId: string }; tuningCents?: number };
const players: Array<Record<string, ReturnType<typeof vi.fn>> & { opts: Opts }> = [];
vi.mock('@thumbline/playback', () => ({
  createPlayer: (opts: Opts) => {
    const p = {
      opts,
      playFrom: vi.fn(async () => opts.onStateChange?.('playing')),
      stop: vi.fn(() => opts.onStateChange?.('idle')),
      setMix: vi.fn(),
      setOriginalLevel: vi.fn(),
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
  suspend = vi.fn(async () => undefined);
  close = vi.fn(async () => undefined);
  destination = {};
  createBufferSource = () => {
    const source = { buffer: null, onended: null, start: vi.fn(), stop: vi.fn(), connect: vi.fn(), disconnect: vi.fn() };
    barSources.push(source);
    return source;
  };
}
const barSources: Array<{ start: ReturnType<typeof vi.fn> }> = [];
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
  songStore.setState({ prefs: { style: 'arpeggio', level: 'basic', pattern: {}, mix: 'both', originalLevel: 0.9, fullness: 5, speed: 1 } });
});

describe('Sheet screen', () => {
  it('shows the song, capo, key, time and tempo', () => {
    render(<Sheet />);
    expect(screen.getByRole('heading', { level: 1, name: 'wonderwall' })).toBeTruthy();
    expect(screen.getByText('Your sheet')).toBeTruthy();
    const fact = (term: string) => screen.getByText(term, { selector: 'dt' }).nextElementSibling?.textContent;
    expect(fact('Capo')).toBe('None');
    expect(fact('Key')).toBe('G major');
    expect(fact('Time')).toBe('4/4');
    expect(fact('Original tempo')).toBe('92 bpm');
  });

  it('sums up the arrangement and steps through patterns', () => {
    render(<Sheet />);
    expect(screen.getByText('Arpeggio · Basic · Let it ring')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next pattern' }));
    expect(screen.getByText('Arpeggio · Basic · Simple roll')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Previous pattern' }));
    expect(screen.getByText('Arpeggio · Basic · Let it ring')).toBeTruthy();
  });

  it('groups the bar cards under section headings', () => {
    render(<Sheet />);
    const tab = screen.getByRole('region', { name: 'Arpeggio tab' });
    expect(tab.querySelectorAll('[data-section] h3').length).toBeGreaterThan(0);
    expect(screen.queryByRole('navigation', { name: 'Sections' })).toBeNull();
  });

  it('shows now and next chords, and the display options change the tab', () => {
    const { container } = render(<Sheet />);
    expect(screen.getByRole('list', { name: 'Now and next chords' })).toBeTruthy();
    expect(container.querySelector('[data-finger]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Display' }));
    // The popover's top layer isn't modelled by jsdom: reach inside as the Review tests do.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Fingering letters', hidden: true }));
    expect(container.querySelector('[data-finger]')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Legend', hidden: true }));
    expect(screen.queryByRole('list', { name: 'Legend' })).toBeNull();
    expect(songStore.getState().prefs.display).toMatchObject({ fingers: false, legend: false });
  });

  it('draws the tab, the chord shapes and a legend', () => {
    render(<Sheet />);
    expect(screen.getByRole('region', { name: 'Arpeggio tab' })).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Chord shapes' })).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Legend' })).toBeTruthy();
  });

  it('switches style and level in Customize, and describes the pattern', () => {
    render(<Sheet />);
    fireEvent.click(screen.getByRole('button', { name: 'Customize' }));
    expect(screen.getByText('Let it ring', { selector: 'b' })).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Fingerstyle' }));
    expect(songStore.getState().prefs.style).toBe('fingerstyle');
    expect(screen.getByText('Thumb and pluck', { selector: 'b' })).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Moderate' }));
    expect(screen.getByText('Travis with pinches', { selector: 'b' })).toBeTruthy();
  });

  it('offers another pattern at the same level', () => {
    render(<Sheet />);
    fireEvent.click(screen.getByRole('button', { name: 'Customize' }));
    fireEvent.click(screen.getByRole('button', { name: 'Try another pattern' }));
    expect(screen.getByText('Simple roll', { selector: 'b' })).toBeTruthy();
  });

  it('plays flamenco: rumba first, tangos on request', () => {
    render(<Sheet />);
    fireEvent.click(screen.getByRole('button', { name: 'Customize' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Flamenco' }));
    expect(songStore.getState().prefs.style).toBe('flamenco');
    expect(screen.getByText('Rumba strum', { selector: 'b' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Flamenco tab' })).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Tangos' }));
    expect(songStore.getState().prefs.palo).toBe('tangos');
    expect(screen.getByText('Tangos strum', { selector: 'b' })).toBeTruthy();
    expect(screen.getByText(/Flamenco \(Tangos\), Basic/)).toBeTruthy();
  });

  it('sets how full the sheet is in Customize, once the slider rests', async () => {
    render(<Sheet />);
    fireEvent.click(screen.getByRole('button', { name: 'Customize' }));
    const slider = screen.getByRole('slider', { name: 'Fullness: 5 of 10' });
    expect(slider.getAttribute('aria-valuetext')).toBe('5 of 10, as written');
    fireEvent.change(slider, { target: { value: String(7 / 9) } });
    expect(screen.getByRole('slider', { name: 'Fullness: 8 of 10' })).toBeTruthy();
    await waitFor(() => expect(songStore.getState().prefs.fullness).toBe(8));
  });

  it('offers flamenco only for songs in 4/4', () => {
    songStore.getState().setStyle('flamenco');
    songStore.getState().setMeter(3);
    render(<Sheet />);
    fireEvent.click(screen.getByRole('button', { name: 'Customize' }));
    const card = screen.getByRole('radio', { name: 'Flamenco' }) as HTMLInputElement;
    expect(card.disabled).toBe(true);
    expect(screen.getByText(/Flamenco needs a song in 4\/4/)).toBeTruthy();
    // A saved flamenco choice plays arpeggio until the song is back in 4/4.
    expect(screen.getByRole('region', { name: 'Arpeggio tab' })).toBeTruthy();
    expect(screen.queryByRole('radiogroup', { name: 'Palo' })).toBeNull();
  });

  it('plays with the original on one context and moves the playhead', async () => {
    const { container } = render(<Sheet />);
    await startPlaying();
    expect(players).toHaveLength(1);
    expect(players[0].playFrom).toHaveBeenCalledWith(0);
    expect(players[0].setMix).toHaveBeenCalledWith('both');
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    act(() => players[0].opts.onCursor(3));
    expect(container.querySelector('[data-playhead]')).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Pause' })));
    expect(players[0].stop).toHaveBeenCalled();
  });

  it('plays the sheet at the recording\'s tuning', async () => {
    songStore.getState().setAnalysis({ ...analysis, tuningCents: -29 });
    render(<Sheet />);
    await startPlaying();
    expect(players[0].opts.tuningCents).toBe(-29);
  });

  it('turns the original down under the sheet', async () => {
    render(<Sheet />);
    await startPlaying();
    expect(players[0].setOriginalLevel).toHaveBeenLastCalledWith(0.9);
    fireEvent.change(screen.getByRole('slider', { name: 'Original volume' }), { target: { value: '0.3' } });
    expect(players[0].setOriginalLevel).toHaveBeenLastCalledWith(0.3);
    expect(songStore.getState().prefs.originalLevel).toBe(0.3);
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
    fireEvent.click(screen.getByRole('button', { name: 'Customize' }));
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
    await waitFor(() => expect(players[0]?.playFrom).toHaveBeenCalled());
    fireEvent.keyDown(window, { key: '3' });
    expect(songStore.getState().prefs.level).toBe('advanced');
    fireEvent.keyDown(window, { key: 'l' });
    expect(screen.getByRole('button', { name: 'Loop' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('resumes from where it was paused', async () => {
    render(<Sheet />);
    await startPlaying();
    const events = (players[0].opts.arrangement as unknown as { events: Array<{ tick: number }> }).events;
    act(() => players[0].opts.onCursor(5));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Pause' })));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Play' })));
    expect(players[0].playFrom).toHaveBeenLastCalledWith(events[5].tick);
  });

  it('plays from where you click on the tab', async () => {
    const { container } = render(<Sheet />);
    const second = container.querySelectorAll('[data-system]')[1] as SVGSVGElement;
    second.getBoundingClientRect = () => ({ left: 0, top: 0, width: 960, height: 162, right: 960, bottom: 162, x: 0, y: 0, toJSON: () => ({}) });
    await act(async () => fireEvent.click(second, { clientX: 480 }));
    await waitFor(() => expect(players[0]?.playFrom).toHaveBeenCalled());
    const tick = players[0].playFrom.mock.calls[0][0] as number;
    // One bar per card: the second card is bar 2.
    expect(Math.floor(tick / 1920)).toBe(1);
  });

  it('moves a bar back and forward while paused, without playing', async () => {
    render(<Sheet />);
    const slider = screen.getByRole('slider', { name: 'Position in song' });
    expect(slider.getAttribute('aria-valuetext')).toBe('Bar 1 of 8');
    fireEvent.click(screen.getByRole('button', { name: 'Forward one bar' }));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(slider.getAttribute('aria-valuetext')).toBe('Bar 3 of 8');
    fireEvent.click(screen.getByRole('button', { name: 'Back one bar' }));
    expect(slider.getAttribute('aria-valuetext')).toBe('Bar 2 of 8');
    expect(players).toHaveLength(0);
    // Play starts from there.
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Play' })));
    await waitFor(() => expect(players[0]?.playFrom).toHaveBeenCalledWith(1920));
  });

  it('jumps while playing', async () => {
    render(<Sheet />);
    await startPlaying();
    await act(async () => fireEvent.change(screen.getByRole('slider', { name: 'Position in song' }), { target: { value: '6' } }));
    expect(players[0].playFrom).toHaveBeenLastCalledWith(6 * 1920);
  });

  it('does not celebrate a play that skipped ahead', async () => {
    render(<Sheet />);
    await startPlaying();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Forward one bar' })));
    act(() => players[0].opts.onEnd?.());
    expect(screen.queryByText(/Nice!/)).toBeNull();
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
    expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
  });

  describe('section settings', () => {
    const panel = (title: string) => document.querySelector(`[role="dialog"][aria-label="Settings for ${title}"][data-popover-open]`) as HTMLElement;

    it('gives a section its own pattern and fullness, for every repeat, or just one', async () => {
      render(<Sheet />);
      // G D Em C twice: Section A, then Section A again.
      const edit = screen.getAllByRole('button', { name: /^Edit section A/ });
      expect(edit).toHaveLength(2);
      await act(async () => fireEvent.click(edit[1]));
      const p = panel('Section A');
      const radios = within(p).getAllByRole('radio', { hidden: true });
      await act(async () => fireEvent.click(radios[2]));
      const patternId = (radios[2] as HTMLInputElement).value;
      expect(songStore.getState().edits.sections).toEqual({ 'letter:A': { patternId } });
      expect(screen.getAllByText('Custom')).toHaveLength(2);

      await act(async () => fireEvent.click(within(p).getByRole('checkbox', { name: /Same as the song/, hidden: true })));
      expect(songStore.getState().edits.sections?.['letter:A']).toEqual({ patternId, fullness: 5 });

      await act(async () => fireEvent.click(within(p).getByRole('checkbox', { name: /Only this one/, hidden: true })));
      expect(Object.keys(songStore.getState().edits.sections ?? {})).toEqual(['letter:A', 'bar:4']);

      await act(async () => fireEvent.click(within(p).getByRole('button', { name: 'Reset section A', hidden: true })));
      expect(Object.keys(songStore.getState().edits.sections ?? {})).toEqual(['letter:A']);
    });
  });

  describe('chords on the sheet', () => {
    // Bar 2's D was hard to hear (Bm close behind); the rest are clear.
    const unsure: AnalysisResult = {
      ...analysis,
      chords: analysis.chords.map((c, i) => (i === 1 ? { ...c, confidence: 0.02, alternatives: [{ pc: 11, quality: 'm' }, { pc: 6, quality: 'm' }] } : c)),
    };
    // jsdom has no :popover-open: an open panel still counts as hidden, so find it by its label.
    const panel = (bar: number) => document.querySelector(`[role="dialog"][aria-label="Chord for bar ${bar}"]`) as HTMLElement;
    const open = async (bar: number) => {
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Bar ${bar}: `) }));
        await new Promise((r) => requestAnimationFrame(() => r(undefined)));
      });
      return panel(bar);
    };

    beforeEach(() => {
      songStore.getState().setAnalysis(unsure);
      barSources.length = 0;
    });

    it('marks the chords we\'re unsure of, in words too, and counts them', () => {
      render(<Sheet />);
      expect(screen.getByRole('button', { name: 'Bar 2: D, likely off. Change chord' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Bar 1: G. Change chord' })).toBeTruthy();
      expect(screen.getByText(/1 chord might be off/)).toBeTruthy();
    });

    it('changes a chord from our suggestions and marks it as the reader\'s', async () => {
      render(<Sheet />);
      const p = await open(2);
      expect(within(p).getByRole('button', { name: 'D, what we heard', hidden: true })).toBeTruthy();
      await act(async () => fireEvent.click(within(p).getByRole('button', { name: 'Bm', hidden: true })));
      expect(songStore.getState().edits.chords[1]).toEqual({ pc: 11, quality: 'm' });
      expect(screen.getByRole('button', { name: 'Bar 2: Bm, your choice. Change chord' })).toBeTruthy();
      expect(screen.queryByText(/might be off/)).toBeNull();
    });

    it('takes a chord we didn\'t suggest', async () => {
      render(<Sheet />);
      const p = await open(2);
      fireEvent.click(within(p).getByRole('button', { name: 'Something else', hidden: true }));
      fireEvent.click(within(p).getByRole('button', { name: 'Bb', hidden: true }));
      fireEvent.click(within(p).getByRole('button', { name: 'Minor', hidden: true }));
      await act(async () => fireEvent.click(within(p).getByRole('button', { name: 'Use Bbm', hidden: true })));
      expect(songStore.getState().edits.chords[1]).toEqual({ pc: 10, quality: 'm' });
    });

    it('opens the chord to check from the notice', async () => {
      render(<Sheet />);
      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Check it' })));
      expect(panel(2).hasAttribute('data-popover-open')).toBe(true);
    });

    it('plays the bar of the original from the picker', async () => {
      render(<Sheet />);
      const p = await open(2);
      fireEvent.click(within(p).getByRole('button', { name: 'Hear this bar', hidden: true }));
      await waitFor(() => expect(barSources).toHaveLength(1));
      expect(barSources[0].start).toHaveBeenCalled();
    });

    it('keeps the capo when a chord changes, and offers a better one', async () => {
      render(<Sheet />);
      await waitFor(() => expect(songStore.getState().edits.capo).toBeDefined());
      const capo = songStore.getState().edits.capo as number;
      act(() => songStore.getState().setCapo(capo === 4 ? 5 : 4));
      const better = screen.getByRole('button', { name: capo > 0 ? `Use capo ${capo}` : 'Take the capo off' });
      act(() => fireEvent.click(better));
      expect(songStore.getState().edits.capo).toBe(capo);
    });

    it('counts the song at half the tempo when it races', () => {
      render(<Sheet />);
      fireEvent.click(screen.getByRole('button', { name: 'Customize' }));
      fireEvent.click(screen.getByRole('radio', { name: 'Half' }));
      expect(songStore.getState().edits.tempoScale).toBe(0.5);
      expect(screen.getByText(/Counted at half the speed we heard: 46 bpm/)).toBeTruthy();
    });

    it('sets the time signature in Customize', () => {
      render(<Sheet />);
      fireEvent.click(screen.getByRole('button', { name: 'Customize' }));
      fireEvent.click(screen.getByRole('radio', { name: '3/4' }));
      expect(songStore.getState().edits.beatsPerBar).toBe(3);
    });
  });
});
