import { fireEvent, render, screen } from '@testing-library/react';
import { ReducedMotionProvider } from '../../motion';
import { axeViolations } from '../../testing/axe';
import { ChordBlock } from './ChordBlock';

describe('ChordBlock', () => {
  it('is a button named by bar and chord', () => {
    render(<ChordBlock bar={3} chord="Am" />);
    expect(screen.getByRole('button', { name: 'Bar 3: Am' })).toBeTruthy();
  });

  it('asks to be checked when low-confidence', () => {
    const { container } = render(<ChordBlock bar={5} chord="Em" status="low" />);
    expect(screen.getByRole('button', { name: 'Bar 5: Em, not sure, tap to choose' })).toBeTruthy();
    expect(container.querySelector('[data-ping]')).toBeTruthy();
  });

  it('shows a tick once confirmed', () => {
    const { container } = render(<ChordBlock bar={5} chord="G" status="confirmed" />);
    expect(screen.getByRole('button', { name: 'Bar 5: G, confirmed' })).toBeTruthy();
    expect(container.querySelector('[data-tick]')).toBeTruthy();
    expect(container.querySelector('[data-ping]')).toBeNull();
  });

  it('marks the open state', () => {
    render(<ChordBlock bar={1} chord="C" open />);
    expect(screen.getByRole('button').dataset['open']).toBe('');
  });

  it('spreads trigger props (popover wiring)', () => {
    const onClick = vi.fn();
    render(<ChordBlock bar={1} chord="C" onClick={onClick} aria-expanded={false} aria-haspopup="dialog" />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('says when there is no chord', () => {
    render(<ChordBlock bar={9} chord={null} />);
    expect(screen.getByRole('button', { name: 'Bar 9: no chord' })).toBeTruthy();
  });

  it('can be spoken differently from what it shows', () => {
    render(<ChordBlock bar={9} chord="A · —" spoken="A, then no chord" />);
    expect(screen.getByRole('button', { name: 'Bar 9: A, then no chord' })).toBeTruthy();
  });

  it('draws the same mini waveform for the same bar', () => {
    const a = render(<ChordBlock bar={7} chord="D" />).container.querySelector('[data-wave]')?.innerHTML;
    const b = render(<ChordBlock bar={7} chord="D" />).container.querySelector('[data-wave]')?.innerHTML;
    expect(a).toBe(b);
  });

  it('stops wiggling under reduced motion', () => {
    render(
      <ReducedMotionProvider reduced>
        <ChordBlock bar={2} chord="F" status="low" />
      </ReducedMotionProvider>,
    );
    expect(screen.getByRole('button').hasAttribute('data-reduced-motion')).toBe(true);
  });

  it('shows and says where the bar starts', () => {
    const { container } = render(<ChordBlock bar={5} chord="Am" time="0:24" />);
    expect(screen.getByRole('button', { name: 'Bar 5 at 0:24: Am' })).toBeTruthy();
    expect(container.querySelector('[data-time]')?.textContent).toBe('0:24');
  });

  it('marks the start of a section', () => {
    const { container } = render(<ChordBlock bar={9} chord="C" time="0:16" section="B" status="low" />);
    expect(screen.getByRole('button', { name: 'Section B starts. Bar 9 at 0:16: C, not sure, tap to choose' })).toBeTruthy();
    expect(container.querySelector('[data-section]')?.textContent).toBe('B');
  });

  it('has no play button unless it can play', () => {
    render(<ChordBlock bar={1} chord="C" />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('plays and stops with its own button, apart from the chord picker', () => {
    const onPlay = vi.fn();
    const onClick = vi.fn();
    const { rerender } = render(<ChordBlock bar={5} chord="Am" time="0:24" onPlay={onPlay} onClick={onClick} />);
    const play = screen.getByRole('button', { name: 'Play bar 5 (0:24)' });
    expect(play.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(play);
    expect(onPlay).toHaveBeenCalledOnce();
    expect(onClick).not.toHaveBeenCalled();

    rerender(<ChordBlock bar={5} chord="Am" time="0:24" onPlay={onPlay} onClick={onClick} playing />);
    expect(play.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /^Bar 5/ }).dataset['playing']).toBe('');
  });

  it('takes a custom play label and is disabled with the block', () => {
    render(<ChordBlock bar={2} chord="G" onPlay={() => undefined} playLabel="Hear bar 2" disabled />);
    expect((screen.getByRole('button', { name: 'Hear bar 2' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /^Bar 2/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('stops the playing waveform under reduced motion', () => {
    render(
      <ReducedMotionProvider reduced>
        <ChordBlock bar={2} chord="F" onPlay={() => undefined} playing />
      </ReducedMotionProvider>,
    );
    expect(screen.getByRole('button', { name: 'Play bar 2' }).hasAttribute('data-reduced-motion')).toBe(true);
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <>
        <ChordBlock bar={1} chord="C" />
        <ChordBlock bar={2} chord="Am" status="low" />
        <ChordBlock bar={3} chord="F" status="confirmed" />
        <ChordBlock bar={4} chord="G" time="0:06" section="A" onPlay={() => undefined} playing />
      </>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
