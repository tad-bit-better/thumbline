import { fireEvent, render, screen } from '@testing-library/react';
import { axeViolations } from '../../testing/axe';
import { IconButton } from './IconButton';

const Icon = () => <svg data-testid="icon" viewBox="0 0 24 24" />;

describe('IconButton', () => {
  it('is labelled by its required label', () => {
    render(<IconButton label="Loop" icon={<Icon />} />);
    expect(screen.getByRole('button', { name: 'Loop' })).toBeTruthy();
    expect(screen.getByTestId('icon').closest('[aria-hidden="true"]')).toBeTruthy();
  });

  it('calls onClick and respects disabled', () => {
    const onClick = vi.fn();
    const { rerender } = render(<IconButton label="Loop" icon={<Icon />} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    rerender(<IconButton label="Loop" icon={<Icon />} onClick={onClick} disabled />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('exposes a toggle state when pressed is set', () => {
    render(<IconButton label="Loop" icon={<Icon />} pressed />);
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true');
  });

  it('has no axe violations', async () => {
    const { container } = render(<IconButton label="Loop" icon={<Icon />} pressed={false} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
