import { describe, expect, it } from 'vitest';
import { crearRng } from '../../../../src/common/utils/random.js';

describe('crearRng', () => {
  it('es determinista con la misma semilla y produce valores en [0, 1)', () => {
    const a = crearRng(42);
    const b = crearRng(42);
    const serieA = Array.from({ length: 50 }, () => a());
    const serieB = Array.from({ length: 50 }, () => b());
    expect(serieA).toEqual(serieB);
    expect(serieA.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it('semillas distintas dan secuencias distintas; sin semilla también funciona', () => {
    expect(crearRng(1)()).not.toBe(crearRng(2)());
    const x = crearRng()();
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThan(1);
  });
});
