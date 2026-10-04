import { act, fireEvent, render, screen } from '@testing-library/react';
import { axeViolations } from '../../testing/axe';
import { Popover } from './Popover';

function setup(onOpenChange = vi.fn()) {
  render(
    <Popover
      label="Alternatives for bar 3"
      onOpenChange={onOpenChange}
      trigger={(props) => (
        <button type="button" {...props}>
          Am
        </button>
      )}
    >
      <button type="button">C</button>
      <button type="button">Em</button>
    </Popover>,
  );
  return { trigger: screen.getByRole('button', { name: 'Am' }), onOpenChange };
}

describe('Popover', () => {
  it('starts closed with the trigger wired to it', () => {
    const { trigger } = setup();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    const panel = document.getElementById(trigger.getAttribute('aria-controls') ?? '');
    expect(panel?.getAttribute('aria-label')).toBe('Alternatives for bar 3');
  });

  it('opens from the trigger and focuses the first control', () => {
    const { trigger, onOpenChange } = setup();
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'C', hidden: true }));
  });

  it('closes when the browser dismisses it and returns focus', () => {
    const { trigger, onOpenChange } = setup();
    fireEvent.click(trigger);
    const panel = document.getElementById(trigger.getAttribute('aria-controls') ?? '') as HTMLElement;
    act(() => panel.hidePopover());
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('toggles closed from the trigger', () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('can be closed from inside via the render prop', () => {
    render(
      <Popover label="x" trigger={(p) => <button type="button" {...p}>Open</button>}>
        {({ close }) => (
          <button type="button" onClick={close}>
            Pick
          </button>
        )}
      </Popover>,
    );
    const trigger = screen.getByRole('button', { name: 'Open' });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'Pick', hidden: true }));
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('has no axe violations', async () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    expect(await axeViolations(document.body)).toEqual([]);
  });
});
