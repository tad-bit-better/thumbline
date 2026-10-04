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

  it('has no axe violations', async () => {
    const { container } = render(
      <>
        <ChordBlock bar={1} chord="C" />
        <ChordBlock bar={2} chord="Am" status="low" />
        <ChordBlock bar={3} chord="F" status="confirmed" />
      </>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
