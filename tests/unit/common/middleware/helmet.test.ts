import { describe, expect, it } from 'vitest';
import { helmet, normalizarHelmet } from '../../../../src/common/middleware/helmet.js';

const funcion = () => () => undefined;

describe('normalizarHelmet', () => {
  it('acepta el import por defecto como función (ESM)', () => {
    expect(normalizarHelmet(funcion)).toBe(funcion);
  });

  it('acepta el import por defecto como módulo CommonJS con .default (compilación de Vercel)', () => {
    expect(normalizarHelmet({ default: funcion })).toBe(funcion);
  });

  it('el helmet exportado es invocable y devuelve un middleware', () => {
    expect(typeof helmet()).toBe('function');
  });
});
