import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { App } from '../App';

export function renderApp(ruta = '/') {
  const usuario = userEvent.setup();
  const vista = render(
    <MemoryRouter initialEntries={[ruta]}>
      <App />
    </MemoryRouter>,
  );
  return { usuario, ...vista };
}
