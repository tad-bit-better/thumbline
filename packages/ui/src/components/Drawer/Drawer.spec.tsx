import { fireEvent, render, screen } from '@testing-library/react';
import { axeViolations } from '../../testing/axe';
import { Drawer } from './Drawer';

describe('Drawer', () => {
  it('opens as a modal labelled by its title', () => {
    render(
      <Drawer open title="Customize" onClose={() => undefined}>
        Style and level
      </Drawer>,
    );
    expect(screen.getByRole('dialog', { name: 'Customize' }).hasAttribute('open')).toBe(true);
  });

  it('closes when open turns false', () => {
    const { container, rerender } = render(
      <Drawer open title="t" onClose={() => undefined}>
        x
      </Drawer>,
    );
    rerender(
      <Drawer open={false} title="t" onClose={() => undefined}>
        x
      </Drawer>,
    );
    expect(container.querySelector('dialog')?.hasAttribute('open')).toBe(false);
  });

  it('asks to close from the close button and from a click outside the panel, not inside it', () => {
    const onClose = vi.fn();
    render(
      <Drawer open title="Customize" onClose={onClose}>
        <p>Inside</p>
      </Drawer>,
    );
    fireEvent.click(screen.getByText('Inside'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <Drawer open title="Customize" onClose={() => undefined}>
        Style and level
      </Drawer>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
