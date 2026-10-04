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
});
