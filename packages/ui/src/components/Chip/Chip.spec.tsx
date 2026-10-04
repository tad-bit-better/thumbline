import { fireEvent, render, screen } from '@testing-library/react';
import { axeViolations } from '../../testing/axe';
import { Chip } from './Chip';

describe('Chip', () => {
  it('renders static text by default', () => {
    render(<Chip>Capo on the 2nd fret</Chip>);
    expect(screen.getByText('Capo on the 2nd fret').closest('button')).toBeNull();
  });

  it.each(['neutral', 'violet', 'orange', 'mint', 'rose'] as const)('supports the %s tone', (tone) => {
    render(<Chip tone={tone}>x</Chip>);
    expect(screen.getByText('x').closest('[data-tone]')?.getAttribute('data-tone')).toBe(tone);
  });

  it('can use the mono font for data', () => {
    render(<Chip font="mono">92 bpm</Chip>);
    expect(screen.getByText('92 bpm').closest('[data-font]')?.getAttribute('data-font')).toBe('mono');
  });

  it('becomes a toggle button when it has onClick', () => {
    const onClick = vi.fn();
    render(
      <Chip onClick={onClick} selected>
        Rumba
      </Chip>,
    );
    const button = screen.getByRole('button', { name: 'Rumba' });
    expect(button.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('hides a decorative icon', () => {
    render(<Chip icon={<svg data-testid="i" />}>song.mp3</Chip>);
    expect(screen.getByTestId('i').closest('[aria-hidden="true"]')).toBeTruthy();
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <>
        <Chip>No capo needed</Chip>
        <Chip onClick={() => undefined} selected={false}>
          Tangos
        </Chip>
      </>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
