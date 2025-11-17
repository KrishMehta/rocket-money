import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';

interface RouterOptions {
  route?: string;
}

export const renderWithRouter = (
  ui: ReactElement,
  { route = '/' }: RouterOptions = {},
  options?: RenderOptions,
) => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      {ui}
    </MemoryRouter>,
    options,
  );
};

export { userEvent };
