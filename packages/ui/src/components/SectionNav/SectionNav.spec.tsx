import { fireEvent, render, screen } from '@testing-library/react';
import { axeViolations } from '../../testing/axe';
import { SectionNav } from './SectionNav';

const ITEMS = [
  { id: 'a', title: 'Section A', detail: 'Bars 1–8' },
  { id: 'b', title: 'Section B', detail: 'Bars 9–16' },
];

describe('SectionNav', () => {
  it('is a named navigation of buttons, the current one marked', () => {
    render(<SectionNav label="Sections" items={ITEMS} current="b" onSelect={() => undefined} />);
    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Section B/ }).getAttribute('aria-current')).toBe('true');
    expect(screen.getByRole('button', { name: /Section A/ }).hasAttribute('aria-current')).toBe(false);
  });

  it('reports the chosen item', () => {
    const onSelect = vi.fn();
    render(<SectionNav label="Sections" items={ITEMS} onSelect={onSelect} variant="chips" />);
    fireEvent.click(screen.getByRole('button', { name: /Section A/ }));
    expect(onSelect).toHaveBeenCalledWith('a');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<SectionNav label="Sections" items={ITEMS} current="a" onSelect={() => undefined} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
