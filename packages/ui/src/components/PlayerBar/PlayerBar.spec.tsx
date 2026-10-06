import { fireEvent, render, screen } from '@testing-library/react';
import { axeViolations } from '../../testing/axe';
import { PlayerBar, type PlayerBarProps } from './PlayerBar';

function setup(extra: Partial<PlayerBarProps> = {}) {
  const props: PlayerBarProps = {
    playing: false,
    onTogglePlay: vi.fn(),
    title: 'Fingerstyle, Moderate',
    subtitle: '92 bpm, sheet and original',
    mix: 'both',
    onMixChange: vi.fn(),
    speed: 1,
    onSpeedChange: vi.fn(),
    loop: false,
    onLoopChange: vi.fn(),
    ...extra,
  };
  render(<PlayerBar {...props} />);
  return props;
}

describe('PlayerBar', () => {
  it('is a labelled region with the now-playing line', () => {
    setup();
    expect(screen.getByRole('region', { name: 'Player' })).toBeTruthy();
    expect(screen.getByText('Fingerstyle, Moderate')).toBeTruthy();
    expect(screen.getByText('92 bpm, sheet and original')).toBeTruthy();
  });

  it('plays and pauses', () => {
    const p = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(p.onTogglePlay).toHaveBeenCalledOnce();
  });

  it('turns the original down in Both', () => {
    const p = setup({ originalLevel: 0.9, onOriginalLevelChange: vi.fn() });
    const volume = screen.getByRole('slider', { name: 'Original volume' });
    expect(volume.getAttribute('aria-valuetext')).toBe('90%');
    fireEvent.change(volume, { target: { value: '0.3' } });
    expect(p.onOriginalLevelChange).toHaveBeenCalledWith(0.3);
  });

  it('shows the original volume only while both play', () => {
    setup({ mix: 'sheet', originalLevel: 0.9, onOriginalLevelChange: vi.fn() });
    expect(screen.queryByRole('slider', { name: 'Original volume' })).toBeNull();
  });

  it('labels the button Pause while playing', () => {
    setup({ playing: true });
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
  });

  it('shows when it is getting ready', () => {
    setup({ preparing: true });
    expect(screen.getByRole('button', { name: 'Getting ready' }).hasAttribute('aria-busy')).toBe(true);
  });

  it('switches the mix and speed', () => {
    const p = setup();
    fireEvent.click(screen.getByRole('radio', { name: 'Original' }));
    expect(p.onMixChange).toHaveBeenCalledWith('original');
    fireEvent.click(screen.getByRole('radio', { name: '75%' }));
    expect(p.onSpeedChange).toHaveBeenCalledWith(0.75);
  });

  it('can turn off mixes that are not available', () => {
    setup({ mixDisabled: true, mix: 'sheet' });
    expect((screen.getByRole('radio', { name: 'Original' }) as HTMLInputElement).disabled).toBe(true);
  });

  it('toggles the loop', () => {
    const p = setup({ loop: true });
    const loop = screen.getByRole('button', { name: 'Loop' });
    expect(loop.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(loop);
    expect(p.onLoopChange).toHaveBeenCalledWith(false);
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <PlayerBar
        playing={false}
        onTogglePlay={() => undefined}
        title="t"
        subtitle="s"
        mix="both"
        onMixChange={() => undefined}
        speed={1}
        onSpeedChange={() => undefined}
        loop={false}
        onLoopChange={() => undefined}
      />,
    );
    expect(await axeViolations(container)).toEqual([]);
  });

  describe('seeking', () => {
    it('moves a bar back and forward', () => {
      const onSeek = vi.fn();
      setup({ position: { bar: 4, bars: 32 }, onSeek });
      fireEvent.click(screen.getByRole('button', { name: 'Back one bar' }));
      fireEvent.click(screen.getByRole('button', { name: 'Forward one bar' }));
      expect(onSeek.mock.calls).toEqual([[3], [5]]);
    });

    it('can’t go before the first bar or past the last', () => {
      setup({ position: { bar: 0, bars: 1 }, onSeek: vi.fn() });
      expect((screen.getByRole('button', { name: 'Back one bar' }) as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByRole('button', { name: 'Forward one bar' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('jumps with the slider and says where it is', () => {
      const onSeek = vi.fn();
      setup({ position: { bar: 4, bars: 32 }, onSeek });
      const slider = screen.getByRole('slider', { name: 'Position in song' });
      expect(slider.getAttribute('aria-valuetext')).toBe('Bar 5 of 32');
      fireEvent.change(slider, { target: { value: '20' } });
      expect(onSeek).toHaveBeenCalledWith(20);
    });

    it('is hidden without a position', () => {
      setup();
      expect(screen.queryByRole('slider')).toBeNull();
    });

    it('has no axe violations with the seek row', async () => {
      setup({ position: { bar: 4, bars: 32 }, onSeek: vi.fn() });
      expect(await axeViolations(document.body)).toEqual([]);
    });
  });
});
