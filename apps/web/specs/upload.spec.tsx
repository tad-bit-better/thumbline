import { act, fireEvent, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { songStore } from '../src/lib/song-store';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: push, prefetch: vi.fn() }) }));

const { default: Upload } = await import('../src/app/page');

const audio = (name = 'take.mp3', type = 'audio/mpeg') => new File([new Uint8Array(4)], name, { type });

beforeEach(() => {
  push.mockClear();
  songStore.setState({ meta: null, file: null, analysis: null, uploadError: null });
});

describe('Upload screen', () => {
  it('sets expectations and reassures about privacy', () => {
    render(<Upload />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Turn any song into a right-hand sheet.');
    expect(screen.getByText('Your audio never leaves this device')).toBeTruthy();
    expect(screen.getByText(/We hear the chords and write a part for you to play/)).toBeTruthy();
    expect(screen.getByText('MP3, WAV or M4A, up to 8 minutes')).toBeTruthy();
  });

  it('starts a song from the file picker and moves to Listen', async () => {
    const { container } = render(<Upload />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [audio()] } });
    });
    expect(songStore.getState().meta?.name).toBe('take.mp3');
    expect(push).toHaveBeenCalledWith('/listen');
  });

  it('accepts a dropped file and highlights the zone while dragging', async () => {
    render(<Upload />);
    const zone = screen.getByRole('button', { name: /drop an audio clip/i });
    fireEvent.dragEnter(zone, { dataTransfer: { types: ['Files'] } });
    expect(zone.hasAttribute('data-dragging')).toBe(true);
    await act(async () => {
      fireEvent.drop(zone, { dataTransfer: { files: [audio('song.wav', 'audio/wav')], types: ['Files'] } });
    });
    expect(zone.hasAttribute('data-dragging')).toBe(false);
    expect(push).toHaveBeenCalledWith('/listen');
  });

  it('explains an unsupported file inside the drop zone and offers a retry', async () => {
    const { container } = render(<Upload />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [audio('notes.pdf', 'application/pdf')] } });
    });
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/MP3, WAV or M4A/);
    expect(screen.getByRole('button', { name: /try another file/i })).toBeTruthy();
  });

  it('shows an error sent back from analysis', () => {
    songStore.setState({ uploadError: 'Clips can be up to 8 minutes long.' });
    render(<Upload />);
    expect(screen.getByRole('alert').textContent).toContain('8 minutes');
  });

  it('loads the sample clip', async () => {
    const fetchMock = vi.fn(async () => new Response(new Blob([new Uint8Array(8)], { type: 'audio/wav' })));
    vi.stubGlobal('fetch', fetchMock);
    render(<Upload />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'or try a sample clip' }));
    });
    expect(fetchMock).toHaveBeenCalledWith('/samples/sample.wav');
    expect(songStore.getState().meta?.name).toMatch(/sample/i);
    expect(push).toHaveBeenCalledWith('/listen');
    vi.unstubAllGlobals();
  });

  it('presents the three styles and how it works', () => {
    render(<Upload />);
    for (const name of ['Arpeggio', 'Fingerstyle', 'Flamenco']) expect(screen.getByRole('heading', { name })).toBeTruthy();
    for (const step of ['Drop a clip', 'We listen', 'You check', 'Play along']) expect(screen.getByText(step)).toBeTruthy();
  });

  it('has no axe violations', async () => {
    const { container } = render(<Upload />);
    const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    expect(result.violations.map((v) => v.id)).toEqual([]);
  });
});
