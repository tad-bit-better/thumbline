import { render, screen } from '@testing-library/react';
import { ReducedMotionProvider } from '../../motion';
import { axeViolations } from '../../testing/axe';
import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
  it('is a labelled progressbar with its value', () => {
    render(<ProgressBar label="Listening" value={0.42} />);
    const bar = screen.getByRole('progressbar', { name: 'Listening' });
    expect(bar.getAttribute('aria-valuenow')).toBe('42');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
  });

  it('clamps the value', () => {
    const { rerender } = render(<ProgressBar label="x" value={1.4} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
    rerender(<ProgressBar label="x" value={-1} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
  });

  it('has no value when indeterminate', () => {
    render(<ProgressBar label="Decoding" />);
    expect(screen.getByRole('progressbar').hasAttribute('aria-valuenow')).toBe(false);
  });

  it('can describe the value in words', () => {
    render(<ProgressBar label="Chords" value={0.5} valueText="bar 23 of 48" />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe('bar 23 of 48');
  });

  it('stops the shimmer under reduced motion', () => {
    render(
      <ReducedMotionProvider reduced>
        <ProgressBar label="x" value={0.3} />
      </ReducedMotionProvider>,
    );
    expect(screen.getByRole('progressbar').hasAttribute('data-reduced-motion')).toBe(true);
  });

  it('has no axe violations', async () => {
    const { container } = render(<ProgressBar label="Listening" value={0.6} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
