import { fireEvent, render, screen } from '@testing-library/react';
import { ReducedMotionProvider } from '../../motion';
import { axeViolations } from '../../testing/axe';
import { SegmentedControl } from './SegmentedControl';

const LEVELS = [
  { value: 'basic', label: 'Basic' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'advanced', label: 'Advanced' },
];

describe('SegmentedControl', () => {
  it('is a labelled radio group with one radio per option', () => {
    render(<SegmentedControl label="Level" options={LEVELS} value="basic" onChange={() => undefined} />);
    const group = screen.getByRole('radiogroup', { name: 'Level' });
    expect(group).toBeTruthy();
    expect(screen.getAllByRole('radio').map((r) => (r as HTMLInputElement).checked)).toEqual([true, false, false]);
    expect(screen.getByRole('radio', { name: 'Moderate' })).toBeTruthy();
  });

  it('reports the chosen value', () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="Level" options={LEVELS} value="basic" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Advanced' }));
    expect(onChange).toHaveBeenCalledWith('advanced');
  });

  it('shows the pill on the selected option only', () => {
    const { container, rerender } = render(
      <SegmentedControl label="Level" options={LEVELS} value="basic" onChange={() => undefined} />,
    );
    expect(container.querySelectorAll('[data-pill]')).toHaveLength(1);
    rerender(<SegmentedControl label="Level" options={LEVELS} value="advanced" onChange={() => undefined} />);
    const pill = container.querySelector('[data-pill]');
    expect(pill?.closest('label')?.textContent).toBe('Advanced');
  });

  it('keeps separate controls independent', () => {
    render(
      <>
        <SegmentedControl label="Level" options={LEVELS} value="basic" onChange={() => undefined} />
        <SegmentedControl label="Speed" options={[{ value: '1', label: '100%' }, { value: '0.5', label: '50%' }]} value="0.5" onChange={() => undefined} />
      </>,
    );
    expect((screen.getByRole('radio', { name: 'Basic' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('radio', { name: '50%' }) as HTMLInputElement).checked).toBe(true);
  });

  it('disables single options or the whole control', () => {
    const { rerender } = render(
      <SegmentedControl
        label="Level"
        options={[...LEVELS.slice(0, 2), { ...LEVELS[2], disabled: true }]}
        value="basic"
        onChange={() => undefined}
      />,
    );
    expect((screen.getByRole('radio', { name: 'Advanced' }) as HTMLInputElement).disabled).toBe(true);
    rerender(<SegmentedControl label="Level" options={LEVELS} value="basic" onChange={() => undefined} disabled />);
    expect(screen.getAllByRole('radio').every((r) => (r as HTMLInputElement).disabled)).toBe(true);
  });

  it('marks itself under reduced motion', () => {
    render(
      <ReducedMotionProvider reduced>
        <SegmentedControl label="Level" options={LEVELS} value="basic" onChange={() => undefined} />
      </ReducedMotionProvider>,
    );
    expect(screen.getByRole('radiogroup').hasAttribute('data-reduced-motion')).toBe(true);
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <SegmentedControl label="Level" options={LEVELS} value="moderate" onChange={() => undefined} />,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
