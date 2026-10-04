// jsdom has no matchMedia; default to "no preference" and let tests override.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

// jsdom lacks <dialog> modality and the Popover API: minimal shims with the same events.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}

if (!('showPopover' in HTMLElement.prototype)) {
  const toggle = (el: HTMLElement, open: boolean) => {
    if (el.hasAttribute('data-popover-open') === open) return;
    el.toggleAttribute('data-popover-open', open);
    el.dispatchEvent(Object.assign(new Event('toggle'), { newState: open ? 'open' : 'closed' }));
  };
  Object.assign(HTMLElement.prototype, {
    showPopover(this: HTMLElement) {
      toggle(this, true);
    },
    hidePopover(this: HTMLElement) {
      toggle(this, false);
    },
  });
}

// jsdom's Blob lacks arrayBuffer(); browsers have it.
if (!Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = function arrayBuffer(this: Blob) {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}
