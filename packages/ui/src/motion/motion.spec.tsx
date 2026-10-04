import { act, render, screen } from '@testing-library/react';
import { PressScale } from './PressScale';
import { Pulse } from './Pulse';
import { REVEAL_MAX_STAGGERED, Reveal } from './Reveal';
import { ReducedMotionProvider } from './useReducedMotion';

const items = (n: number) => Array.from({ length: n }, (_, i) => <span key={i}>n{i}</span>);

describe('Reveal', () => {
  it('wraps each child with its stagger index', () => {
    const { container } = render(<Reveal>{items(3)}</Reveal>);
    const wrapped = container.querySelectorAll('[data-reveal-item]');
    expect(wrapped).toHaveLength(3);
    expect((wrapped[2] as HTMLElement).style.getPropertyValue('--reveal-index')).toBe('2');
  });

  it(`staggers at most ${REVEAL_MAX_STAGGERED} items and shows the rest together`, () => {
    const { container } = render(<Reveal>{items(REVEAL_MAX_STAGGERED + 5)}</Reveal>);
    const last = container.querySelectorAll('[data-reveal-item]')[REVEAL_MAX_STAGGERED + 4] as HTMLElement;
    expect(last.style.getPropertyValue('--reveal-index')).toBe(String(REVEAL_MAX_STAGGERED));
  });

  it('replays when revealKey changes', () => {
    const { container, rerender } = render(<Reveal revealKey="a">{items(2)}</Reveal>);
    const before = container.querySelector('[data-reveal-item]');
    rerender(<Reveal revealKey="b">{items(2)}</Reveal>);
    expect(container.querySelector('[data-reveal-item]')).not.toBe(before);
  });

  it('renders SVG groups when used inside a tab', () => {
    const { container } = render(
      <svg>
        <Reveal as="g">
          <circle r={1} />
        </Reveal>
      </svg>,
    );
    expect(container.querySelector('g[data-reveal-item] circle')).toBeTruthy();
  });

  it('renders children without animation under reduced motion', () => {
    const { container } = render(
      <ReducedMotionProvider reduced>
        <Reveal>{items(2)}</Reveal>
      </ReducedMotionProvider>,
    );
    expect(container.querySelector('[data-reveal-item]')).toBeNull();
    expect(screen.getByText('n1')).toBeTruthy();
  });
});

describe('PressScale', () => {
  it('renders its child content', () => {
    render(
      <PressScale>
        <button type="button">Go</button>
      </PressScale>,
    );
    expect(screen.getByRole('button', { name: 'Go' })).toBeTruthy();
  });

  it('marks itself reduced under reduced motion', () => {
    const { container } = render(
      <ReducedMotionProvider reduced>
        <PressScale>x</PressScale>
      </ReducedMotionProvider>,
    );
    expect(container.firstElementChild?.hasAttribute('data-reduced-motion')).toBe(true);
  });
});

describe('Pulse', () => {
  it('runs while visible and pauses when the tab is hidden', () => {
    const { container } = render(<Pulse>dot</Pulse>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.dataset['paused']).toBeUndefined();

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(el.dataset['paused']).toBe('');

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(el.dataset['paused']).toBeUndefined();
  });

  it('sets the loop period', () => {
    const { container } = render(<Pulse periodMs={900}>dot</Pulse>);
    expect((container.firstElementChild as HTMLElement).style.getPropertyValue('--pulse-period')).toBe('900ms');
  });

  it('stops under reduced motion', () => {
    const { container } = render(
      <ReducedMotionProvider reduced>
        <Pulse>dot</Pulse>
      </ReducedMotionProvider>,
    );
    expect(container.firstElementChild?.hasAttribute('data-reduced-motion')).toBe(true);
  });
});
