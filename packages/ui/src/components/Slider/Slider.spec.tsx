import { fireEvent, render, screen } from '@testing-library/react';
import { axeViolations } from '../../testing/axe';
import { Slider } from './Slider';

describe('Slider', () => {
  it('is a labelled slider with words at both ends', () => {
    render(<Slider label="Energy" value={0.3} onChange={() => undefined} minLabel="Calm" maxLabel="Driving" />);
    const slider = screen.getByRole('slider', { name: 'Energy' });
    expect((slider as HTMLInputElement).value).toBe('0.3');
    expect(slider.getAttribute('aria-valuetext')).toBe('30%');
    expect(screen.getByText('Calm')).toBeTruthy();
    expect(screen.getByText('Driving')).toBeTruthy();
  });

  it('reports the new value', () => {
    const onChange = vi.fn();
    render(<Slider label="Energy" value={0.3} onChange={onChange} minLabel="Calm" maxLabel="Driving" />);
    fireEvent.change(screen.getByRole('slider', { name: 'Energy' }), { target: { value: '0.75' } });
    expect(onChange).toHaveBeenCalledWith(0.75);
  });

  it('says what a value means to a screen reader when asked', () => {
    render(<Slider label="Colour" value={0.8} onChange={() => undefined} minLabel="Dark" maxLabel="Bright" valueText={(v) => (v > 0.5 ? 'bright' : 'dark')} />);
    expect(screen.getByRole('slider', { name: 'Colour' }).getAttribute('aria-valuetext')).toBe('bright');
  });

  it('can be disabled', () => {
    render(<Slider label="Energy" value={0.3} onChange={() => undefined} minLabel="Calm" maxLabel="Driving" disabled />);
    expect((screen.getByRole('slider', { name: 'Energy' }) as HTMLInputElement).disabled).toBe(true);
  });

  it('has no axe violations', async () => {
    const { container } = render(<Slider label="Energy" value={0.3} onChange={() => undefined} minLabel="Calm" maxLabel="Driving" />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
