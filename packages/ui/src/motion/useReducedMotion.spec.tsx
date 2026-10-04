import { render, screen } from '@testing-library/react';
import { ReducedMotionProvider, useReducedMotion } from './useReducedMotion';

function Probe() {
  return <span>{useReducedMotion() ? 'reduced' : 'full'}</span>;
}

function mockMediaQuery(matches: boolean) {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    ...original(query),
    matches: query.includes('reduce') ? matches : false,
  })) as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

describe('useReducedMotion', () => {
  it('is false when the system has no preference', () => {
    render(<Probe />);
    expect(screen.getByText('full')).toBeTruthy();
  });

  it('follows the system setting', () => {
    const restore = mockMediaQuery(true);
    render(<Probe />);
    expect(screen.getByText('reduced')).toBeTruthy();
    restore();
  });

  it('can be forced on by a provider', () => {
    render(
      <ReducedMotionProvider reduced>
        <Probe />
      </ReducedMotionProvider>,
    );
    expect(screen.getByText('reduced')).toBeTruthy();
  });

  it('can be forced off by a provider', () => {
    const restore = mockMediaQuery(true);
    render(
      <ReducedMotionProvider reduced={false}>
        <Probe />
      </ReducedMotionProvider>,
    );
    expect(screen.getByText('full')).toBeTruthy();
    restore();
  });
});
