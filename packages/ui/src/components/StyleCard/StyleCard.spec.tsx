import { fireEvent, render, screen } from '@testing-library/react';
import { axeViolations } from '../../testing/axe';
import { StyleCard } from './StyleCard';

describe('StyleCard', () => {
  it('is a static card without onSelect', () => {
    render(<StyleCard kind="arpeggio" title="Arpeggio" hint="Notes one after another." />);
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Arpeggio' })).toBeTruthy();
  });

  it('is a radio labelled by its title when selectable', () => {
    const onSelect = vi.fn();
    render(
      <StyleCard kind="fingerstyle" title="Fingerstyle" hint="Thumb and fingers." name="style" onSelect={onSelect} />,
    );
    const radio = screen.getByRole('radio', { name: /Fingerstyle/ });
    fireEvent.click(radio);
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('reflects the selected state', () => {
    render(
      <StyleCard kind="flamenco" title="Flamenco" hint="Rasgueado." name="style" selected onSelect={() => undefined} />,
    );
    expect((screen.getByRole('radio') as HTMLInputElement).checked).toBe(true);
  });

  it.each([
    ['arpeggio', 'violet'],
    ['fingerstyle', 'mint'],
    ['flamenco', 'rose'],
  ] as const)('gives %s its style colour', (kind, tone) => {
    const { container } = render(<StyleCard kind={kind} title="t" hint="h" />);
    expect(container.querySelector('[data-tone]')?.getAttribute('data-tone')).toBe(tone);
  });

  it('shows a sub-label', () => {
    render(<StyleCard kind="flamenco" title="Flamenco" hint="h" sublabel="Rumba" />);
    expect(screen.getByText('Rumba')).toBeTruthy();
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <div role="radiogroup" aria-label="Style">
        <StyleCard kind="arpeggio" title="Arpeggio" hint="h" name="s" selected onSelect={() => undefined} />
        <StyleCard kind="fingerstyle" title="Fingerstyle" hint="h" name="s" onSelect={() => undefined} />
      </div>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
