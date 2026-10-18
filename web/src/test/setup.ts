import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { limpiarSesion } from '../api/tokens';

afterEach(() => {
  cleanup();
  limpiarSesion();
});
