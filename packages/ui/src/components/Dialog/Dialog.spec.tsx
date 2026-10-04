import { fireEvent, render, screen } from '@testing-library/react';
import { axeViolations } from '../../testing/axe';
import { Dialog } from './Dialog';

describe('Dialog', () => {
  it('opens as a modal labelled by its title', () => {
    render(
      <Dialog open title="Start a new song?" onClose={() => undefined}>
        Your current sheet will be replaced.
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Start a new song?' });
    expect(dialog.hasAttribute('open')).toBe(true);
  });

  it('stays closed when open is false', () => {
    const { container } = render(
      <Dialog open={false} title="t" onClose={() => undefined}>
        x
      </Dialog>,
    );
    expect(container.querySelector('dialog')?.hasAttribute('open')).toBe(false);
  });

  it('closes when open turns false', () => {
    const { container, rerender } = render(
      <Dialog open title="t" onClose={() => undefined}>
        x
      </Dialog>,
    );
    rerender(
      <Dialog open={false} title="t" onClose={() => undefined}>
        x
      </Dialog>,
    );
    expect(container.querySelector('dialog')?.hasAttribute('open')).toBe(false);
  });

  it('calls onClose from the close button', () => {
    const onClose = vi.fn();
    render(
      <Dialog open title="t" onClose={onClose}>
        x
      </Dialog>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose on Escape (cancel)', () => {
    const onClose = vi.fn();
    render(
      <Dialog open title="t" onClose={onClose}>
        x
      </Dialog>,
    );
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders actions in the footer', () => {
    render(
      <Dialog open title="t" onClose={() => undefined} actions={<button type="button">Replace</button>}>
        x
      </Dialog>,
    );
    expect(screen.getByRole('button', { name: 'Replace' })).toBeTruthy();
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <Dialog open title="Start a new song?" onClose={() => undefined}>
        Body
      </Dialog>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
