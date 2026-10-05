import { act, renderHook } from '@testing-library/react';
import { SETTLE_MS, useFollowPlayhead } from './use-follow-playhead';

describe('useFollowPlayhead', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const fire = (type: string, init: object = {}) => act(() => void window.dispatchEvent(Object.assign(new Event(type), init)));

  it('follows until the reader scrolls', () => {
    const { result } = renderHook(() => useFollowPlayhead());
    expect(result.current.following).toBe(true);
    fire('wheel');
    expect(result.current.following).toBe(false);
  });

  it('counts touch and scroll keys, but not Space (play) or keys in a control', () => {
    const { result } = renderHook(() => useFollowPlayhead());
    fire('keydown', { key: ' ' });
    expect(result.current.following).toBe(true);
    const slider = document.createElement('input');
    slider.type = 'range';
    document.body.append(slider);
    act(() => void slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
    expect(result.current.following).toBe(true);
    fire('keydown', { key: 'PageDown' });
    expect(result.current.following).toBe(false);
    slider.remove();
  });

  it('never comes back on a timer alone while the playing row is off screen', () => {
    const { result } = renderHook(() => useFollowPlayhead());
    act(() => result.current.onPlayheadView('below'));
    fire('touchmove');
    act(() => void vi.advanceTimersByTime(SETTLE_MS * 10));
    expect(result.current.following).toBe(false);
    expect(result.current.where).toBe('below');
  });

  it('comes back when the reader rests with the playing row on screen', () => {
    const { result } = renderHook(() => useFollowPlayhead());
    fire('wheel');
    act(() => result.current.onPlayheadView('visible'));
    act(() => void vi.advanceTimersByTime(SETTLE_MS / 2));
    expect(result.current.following).toBe(false);
    act(() => void vi.advanceTimersByTime(SETTLE_MS));
    expect(result.current.following).toBe(true);
  });

  it('goes back to the playhead on the pill or F, and follows again on a seek', () => {
    const { result } = renderHook(() => useFollowPlayhead());
    fire('wheel');
    act(() => result.current.back());
    expect([result.current.following, result.current.jumpKey]).toEqual([true, 1]);
    fire('wheel');
    fire('keydown', { key: 'f' });
    expect([result.current.following, result.current.jumpKey]).toEqual([true, 2]);
    fire('wheel');
    act(() => result.current.resume());
    expect([result.current.following, result.current.jumpKey]).toEqual([true, 2]);
  });
});
