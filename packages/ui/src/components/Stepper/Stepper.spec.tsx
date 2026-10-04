import { render, screen } from '@testing-library/react';
import { axeViolations } from '../../testing/axe';
import { Stepper } from './Stepper';

const STEPS = ['Upload', 'Listen', 'Review', 'Play'];

describe('Stepper', () => {
  it('is a labelled ordered list of steps', () => {
    render(<Stepper steps={STEPS} current={2} />);
    expect(screen.getByRole('navigation', { name: 'Progress' })).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });

  it('marks done, current and upcoming steps', () => {
    render(<Stepper steps={STEPS} current={2} />);
    const items = screen.getAllByRole('listitem');
    expect(items.map((li) => li.dataset['state'])).toEqual(['done', 'done', 'current', 'upcoming']);
    expect(items[2].getAttribute('aria-current')).toBe('step');
    expect(items[0].getAttribute('aria-current')).toBeNull();
  });

  it('tells screen readers which steps are done', () => {
    render(<Stepper steps={STEPS} current={1} />);
    expect(screen.getByText('Upload').closest('li')?.textContent).toContain('done');
  });

  it('has no axe violations', async () => {
    const { container } = render(<Stepper steps={STEPS} current={1} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
