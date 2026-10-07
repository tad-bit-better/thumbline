import { fireEvent, render, screen } from '@testing-library/react';
import { axeViolations } from '../../testing/axe';
import { RadioList } from './RadioList';

const OPTIONS = [
  { value: 'auto', label: 'Auto', hint: 'As the rest of the song' },
  { value: 'ballad', label: 'Ballad' },
  { value: 'travis', label: 'Travis picking' },
];

describe('RadioList', () => {
  it('is a labelled radio group that reports the choice', () => {
    const onChange = vi.fn();
    render(<RadioList label="Pattern" options={OPTIONS} value="auto" onChange={onChange} />);
    expect(screen.getByRole('radiogroup', { name: 'Pattern' })).toBeTruthy();
    expect((screen.getByRole('radio', { name: /Auto/ }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: 'Travis picking' }));
    expect(onChange).toHaveBeenCalledWith('travis');
  });

  it('can be disabled', () => {
    render(<RadioList label="Pattern" options={OPTIONS} value="auto" onChange={() => undefined} disabled />);
    expect(screen.getAllByRole('radio').every((r) => (r as HTMLInputElement).disabled)).toBe(true);
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<RadioList label="Pattern" options={OPTIONS} value="ballad" onChange={() => undefined} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
