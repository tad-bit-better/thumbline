import { render } from '@testing-library/react';

import { ThumblineUi } from './ui';

describe('ThumblineUi', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<ThumblineUi />);
    expect(baseElement).toBeTruthy();
  });
});
