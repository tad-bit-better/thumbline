import { render, screen } from '@testing-library/react';
import { axeViolations } from '../../testing/axe';
import { Logo, LogoMark } from './Logo';

describe('LogoMark', () => {
  it('is decorative by default and an image with a name when labelled', () => {
    const { container } = render(<LogoMark />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    render(<LogoMark label="Thumbline" />);
    expect(screen.getByRole('img', { name: 'Thumbline' })).toBeTruthy();
  });

  it('draws the thumbprint flowing into the strings, with fret numbers', () => {
    const { container } = render(<LogoMark size={64} />);
    expect(container.querySelectorAll('[data-ridge]')).toHaveLength(6);
    expect(container.querySelectorAll('[data-fret]')).toHaveLength(3);
    // Drawn, not typed: no stray "025" in the page's text.
    expect(container.textContent).toBe('');
  });

  it('draws fewer, bolder ridges and no numbers at favicon size', () => {
    const { container } = render(<LogoMark size={16} />);
    expect(container.querySelectorAll('[data-ridge]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-fret]')).toHaveLength(0);
  });

  it('uses unique gradient ids per instance', () => {
    const { container } = render(
      <>
        <LogoMark />
        <LogoMark />
      </>,
    );
    const ids = [...container.querySelectorAll('[id]')].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('Logo', () => {
  it('reads as the name, with the mark decorative', () => {
    render(<Logo />);
    expect(screen.getByText('Thumbline')).toBeTruthy();
    const { container } = render(<Logo />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('scales the mark', () => {
    const { container } = render(<Logo size={64} />);
    expect(container.querySelector('svg')?.getAttribute('width')).toBe('64');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<Logo />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
