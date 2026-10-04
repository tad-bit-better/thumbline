import { render, screen } from '@testing-library/react';
import Page from '../src/app/page';

describe('Page', () => {
  it('renders the app name', () => {
    render(<Page />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Thumbline' }),
    ).toBeTruthy();
  });
});
