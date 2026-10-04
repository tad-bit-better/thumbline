import { render, screen } from '@testing-library/react';
import { ReducedMotionProvider } from '../../motion';
import { axeViolations } from '../../testing/axe';
import { Card } from './Card';

describe('Card', () => {
  it('renders a div by default', () => {
    render(<Card>Content</Card>);
    expect(screen.getByText('Content').tagName).toBe('DIV');
  });

  it('can render as a landmark or article', () => {
    render(
      <Card as="section" aria-label="Chord shapes">
        Shapes
      </Card>,
    );
    expect(screen.getByRole('region', { name: 'Chord shapes' })).toBeTruthy();
  });

  it('flags interactive cards for the hover lift', () => {
    render(<Card interactive>Lift</Card>);
    expect(screen.getByText('Lift').hasAttribute('data-interactive')).toBe(true);
  });

  it.each(['sm', 'md', 'lg'] as const)('supports %s padding', (padding) => {
    render(<Card padding={padding}>p</Card>);
    expect(screen.getByText('p').getAttribute('data-padding')).toBe(padding);
  });

  it('marks itself under reduced motion', () => {
    render(
      <ReducedMotionProvider reduced>
        <Card interactive>Still</Card>
      </ReducedMotionProvider>,
    );
    expect(screen.getByText('Still').hasAttribute('data-reduced-motion')).toBe(true);
  });

  it('has no axe violations', async () => {
    const { container } = render(<Card as="article">Hi</Card>);
    expect(await axeViolations(container)).toEqual([]);
  });
});
