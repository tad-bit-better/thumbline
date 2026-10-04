import { render } from '@testing-library/react';

import { ThumblineTabRenderer } from './tab-renderer';

describe('ThumblineTabRenderer', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<ThumblineTabRenderer />);
    expect(baseElement).toBeTruthy();
  });
});
