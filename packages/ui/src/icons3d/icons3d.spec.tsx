import { render, screen } from '@testing-library/react';
import { axeViolations } from '../testing/axe';
import { ICONS_3D } from './index';

const entries = Object.entries(ICONS_3D);

describe('3D icons', () => {
  it('includes the v1 set', () => {
    expect(Object.keys(ICONS_3D).sort()).toEqual(
      ['Arpeggio', 'CheckBadge', 'Fingerstyle', 'Flamenco', 'Metronome', 'Pick', 'PlaySphere', 'Upload', 'WaveformTile'].sort(),
    );
  });

  describe.each(entries)('%s', (_name, Icon) => {
    it('is decorative by default', () => {
      const { container } = render(<Icon />);
      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
      expect(svg?.hasAttribute('data-tilt')).toBe(true);
    });

    it('is an image with a name when labelled', () => {
      render(<Icon label="Picture" />);
      expect(screen.getByRole('img', { name: 'Picture' })).toBeTruthy();
    });

    it('sizes itself', () => {
      const { container } = render(<Icon size={96} />);
      expect(container.querySelector('svg')?.getAttribute('width')).toBe('96');
    });

    it('uses unique gradient ids per instance', () => {
      const { container } = render(
        <>
          <Icon />
          <Icon />
        </>,
      );
      const ids = [...container.querySelectorAll('[id]')].map((el) => el.id);
      expect(ids.length).toBeGreaterThan(0);
      expect(new Set(ids).size).toBe(ids.length);
      for (const el of container.querySelectorAll('[fill^="url("]')) {
        const ref = /url\(#(.+)\)/.exec(el.getAttribute('fill') ?? '')?.[1];
        expect(ids).toContain(ref);
      }
    });

    it('takes every colour from tokens', () => {
      const { container } = render(<Icon />);
      expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    });

    it('has no axe violations', async () => {
      const { container } = render(<Icon label="Icon" />);
      expect(await axeViolations(container)).toEqual([]);
    });
  });
});
