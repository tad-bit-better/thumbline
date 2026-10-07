import { fireEvent, render, screen } from '@testing-library/react';
import { axeViolations } from '../../testing/axe';
import { ChordChip } from './ChordChip';

describe('ChordChip', () => {
  it('is a button named for its bar, chord and status', () => {
    const onClick = vi.fn();
    render(<ChordChip bar={5} spoken="A minor" status="check" onClick={onClick}>Am</ChordChip>);
    const chip = screen.getByRole('button', { name: 'Bar 5: A minor, might be off. Change chord' });
    fireEvent.click(chip);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('says each status in words, not only colour', () => {
    const { rerender } = render(<ChordChip bar={1} status="likely">G</ChordChip>);
    expect(screen.getByRole('button').getAttribute('aria-label')).toBe('Bar 1: G, likely off. Change chord');
    expect(screen.getByRole('button').querySelector('[data-dot="likely"]')?.textContent).toBe('!');
    rerender(<ChordChip bar={1} status="yours">G</ChordChip>);
    expect(screen.getByRole('button').getAttribute('aria-label')).toBe('Bar 1: G, your choice. Change chord');
    rerender(<ChordChip bar={1}>G</ChordChip>);
    expect(screen.getByRole('button').getAttribute('aria-label')).toBe('Bar 1: G. Change chord');
    expect(screen.getByRole('button').querySelector('[data-dot]')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<ChordChip bar={2} status="check">Em</ChordChip>);
    expect(await axeViolations(container)).toEqual([]);
  });
});
