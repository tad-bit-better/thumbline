import { fireEvent, render, screen } from '@testing-library/react';
import { ReducedMotionProvider } from '../../motion';
import { axeViolations } from '../../testing/axe';
import { Button } from './Button';

describe('Button', () => {
  it('is a real button that defaults to type="button"', () => {
    render(<Button>Choose a file</Button>);
    const button = screen.getByRole('button', { name: 'Choose a file' });
    expect(button.getAttribute('type')).toBe('button');
  });

  it('calls onClick', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not fire when disabled', () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Go
      </Button>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it.each(['primary', 'secondary', 'ghost'] as const)('renders the %s variant', (variant) => {
    render(<Button variant={variant}>Go</Button>);
    expect(screen.getByRole('button').dataset['variant']).toBe(variant);
  });

  it('renders a leading icon hidden from assistive tech', () => {
    render(<Button icon={<svg data-testid="icon" />}>Play</Button>);
    expect(screen.getByTestId('icon').closest('[aria-hidden="true"]')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
  });

  it('forwards extra props and refs', () => {
    let ref: HTMLButtonElement | null = null;
    render(
      <Button type="submit" aria-describedby="hint" ref={(el) => {
        ref = el;
      }}>
        Send
      </Button>,
    );
    expect(ref).toBe(screen.getByRole('button'));
    expect(screen.getByRole('button').getAttribute('type')).toBe('submit');
  });

  it('marks itself under reduced motion', () => {
    render(
      <ReducedMotionProvider reduced>
        <Button>Go</Button>
      </ReducedMotionProvider>,
    );
    expect(screen.getByRole('button').hasAttribute('data-reduced-motion')).toBe(true);
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <>
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost" disabled>
          Ghost
        </Button>
      </>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
