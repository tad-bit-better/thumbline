import { act, fireEvent, render, screen } from '@testing-library/react';
import { axeViolations } from '../../testing/axe';
import { TOAST_MS, ToastProvider, useToast } from './Toast';

function Trigger({ message = 'Chord updated', tone }: { message?: string; tone?: 'neutral' | 'success' | 'warning' }) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast({ message, tone })}>
      Notify
    </button>
  );
}

describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('announces messages in a polite live region that exists before them', () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    const region = screen.getByRole('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    fireEvent.click(screen.getByRole('button', { name: 'Notify' }));
    expect(region.textContent).toContain('Chord updated');
  });

  it('dismisses after a while', () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Notify' }));
    act(() => {
      vi.advanceTimersByTime(TOAST_MS + 50);
    });
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('can be dismissed by hand', () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Notify' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('stacks several messages, newest last', () => {
    render(
      <ToastProvider>
        <Trigger message="One" />
        <Trigger message="Two" />
      </ToastProvider>,
    );
    const [a, b] = screen.getAllByRole('button', { name: 'Notify' });
    fireEvent.click(a);
    fireEvent.click(b);
    expect(screen.getByRole('status').textContent).toMatch(/One.*Two/);
  });

  it('throws a clear error outside a provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Trigger />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });

  it('has no axe violations', async () => {
    vi.useRealTimers();
    const { container } = render(
      <ToastProvider>
        <Trigger tone="success" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Notify' }));
    expect(await axeViolations(container)).toEqual([]);
  });
});
