import { fireEvent, render, screen } from '@testing-library/react';
import { axeViolations } from '../../testing/axe';
import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('is a labelled checkbox that reports changes', () => {
    const onChange = vi.fn();
    render(<Checkbox label="Legend" checked onChange={onChange} />);
    const box = screen.getByRole('checkbox', { name: 'Legend' });
    expect((box as HTMLInputElement).checked).toBe(true);
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('can be disabled', () => {
    render(<Checkbox label="Legend" checked={false} onChange={() => undefined} disabled />);
    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<Checkbox label="Fingering letters" checked onChange={() => undefined} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
