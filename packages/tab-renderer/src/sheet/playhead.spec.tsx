import { render } from '@testing-library/react';
import { ReducedMotionProvider } from '@thumbline/ui';
import { layoutSheet } from '../layout/layout';
import { sheet } from '../testing/fixtures';
import { TabSheet } from './TabSheet';

const pop = sheet('G | D | Em | C | G | D | C | C');

describe('TabSheet reveal', () => {
  it('pops notes in on first render', () => {
    const { container } = render(<TabSheet arrangement={pop} width={1200} />);
    expect(container.querySelectorAll('[data-reveal-item]').length).toBe(pop.events.length);
  });

  it('replays when the style, level or pattern changes', () => {
    const { container, rerender } = render(<TabSheet arrangement={pop} width={1200} />);
    const before = container.querySelector('[data-reveal-item]');
    rerender(<TabSheet arrangement={sheet('G | D | Em | C | G | D | C | C', 'arpeggio', 'moderate')} width={1200} />);
    expect(container.querySelector('[data-reveal-item]')).not.toBe(before);
  });

  it('does not replay when only the width changes', () => {
    const { container, rerender } = render(<TabSheet arrangement={pop} width={1200} />);
    const before = container.querySelector('[data-reveal-item]');
    rerender(<TabSheet arrangement={pop} width={1180} />);
    expect(container.querySelector('[data-reveal-item]')).toBe(before);
  });

  it('is skipped under reduced motion', () => {
    const { container } = render(
      <ReducedMotionProvider reduced>
        <TabSheet arrangement={pop} width={1200} />
      </ReducedMotionProvider>,
    );
    expect(container.querySelector('[data-reveal-item]')).toBeNull();
    expect(container.querySelectorAll('[data-note]')).toHaveLength(pop.events.length);
  });
});

describe('TabSheet playhead', () => {
  const layout = layoutSheet(pop, 1200);
  const lastIndex = pop.events.length - 1;

  it('has no playhead without a cursor', () => {
    const { container } = render(<TabSheet arrangement={pop} width={1200} />);
    expect(container.querySelector('[data-playhead]')).toBeNull();
  });

  it('draws one playhead at the cursor event, in its system', () => {
    const { container } = render(<TabSheet arrangement={pop} width={1200} cursorIndex={lastIndex} />);
    const heads = container.querySelectorAll('[data-playhead]');
    expect(heads).toHaveLength(1);
    const svgs = [...container.querySelectorAll('svg')];
    expect(svgs.indexOf(heads[0].closest('svg') as SVGSVGElement)).toBe(layout.positions[lastIndex].system);
    expect((heads[0] as SVGGElement).style.transform).toBe(`translateX(${layout.positions[lastIndex].x}px)`);
  });

  it('highlights the notes under the playhead', () => {
    const { container } = render(<TabSheet arrangement={pop} width={1200} cursorIndex={0} />);
    const active = [...container.querySelectorAll('[data-note][data-active]')];
    const atZero = pop.events.filter((e) => e.tick === 0).length;
    expect(active).toHaveLength(atZero);
  });

  it('glows, except under reduced motion', () => {
    const { container, unmount } = render(<TabSheet arrangement={pop} width={1200} cursorIndex={3} />);
    expect(container.querySelector('[data-playhead-glow]')).toBeTruthy();
    unmount();
    const reduced = render(
      <ReducedMotionProvider reduced>
        <TabSheet arrangement={pop} width={1200} cursorIndex={3} />
      </ReducedMotionProvider>,
    );
    expect(reduced.container.querySelector('[data-playhead]')).toBeTruthy();
    expect(reduced.container.querySelector('[data-playhead-glow]')).toBeNull();
  });

  it('scrolls a new system into view as the playhead moves on', () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    const firstOfSystem2 = layout.positions.findIndex((p) => p.system === 1);
    const { rerender } = render(<TabSheet arrangement={pop} width={1200} cursorIndex={0} />);
    scroll.mockClear();
    rerender(<TabSheet arrangement={pop} width={1200} cursorIndex={1} />);
    expect(scroll).not.toHaveBeenCalled();
    rerender(<TabSheet arrangement={pop} width={1200} cursorIndex={firstOfSystem2} />);
    expect(scroll).toHaveBeenCalledOnce();
  });

  it('stays put while not following, and centres the playing row when asked', () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    const firstOfSystem2 = layout.positions.findIndex((p) => p.system === 1);
    const { rerender } = render(<TabSheet arrangement={pop} width={1200} cursorIndex={0} follow={false} />);
    rerender(<TabSheet arrangement={pop} width={1200} cursorIndex={firstOfSystem2} follow={false} />);
    expect(scroll).not.toHaveBeenCalled();
    // Asked to come back: the playing row is centred.
    rerender(<TabSheet arrangement={pop} width={1200} cursorIndex={firstOfSystem2} follow={false} jumpKey={1} />);
    expect(scroll).toHaveBeenCalledWith({ block: 'center', behavior: expect.any(String) });
  });

  it('reports whether the playing row is on screen', () => {
    let callback: IntersectionObserverCallback = () => undefined;
    const original = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = class {
      constructor(cb: IntersectionObserverCallback) {
        callback = cb;
      }
      observe = vi.fn();
      disconnect = vi.fn();
    } as unknown as typeof IntersectionObserver;
    const onPlayheadView = vi.fn();
    render(<TabSheet arrangement={pop} width={1200} cursorIndex={0} onPlayheadView={onPlayheadView} />);
    const entry = (isIntersecting: boolean, top: number) => [{ isIntersecting, boundingClientRect: { top } }] as unknown as IntersectionObserverEntry[];
    callback(entry(false, -300), {} as IntersectionObserver);
    callback(entry(false, 900), {} as IntersectionObserver);
    callback(entry(true, 100), {} as IntersectionObserver);
    expect(onPlayheadView.mock.calls.map((c) => c[0])).toEqual(['above', 'below', 'visible']);
    globalThis.IntersectionObserver = original;
  });

  it('ignores a cursor outside the events', () => {
    const { container } = render(<TabSheet arrangement={pop} width={1200} cursorIndex={9999} />);
    expect(container.querySelector('[data-playhead]')).toBeNull();
  });
});
