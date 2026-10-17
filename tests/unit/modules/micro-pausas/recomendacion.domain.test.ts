import { describe, expect, it } from 'vitest';
import { crearRng } from '../../../../src/common/utils/random.js';
import { recomendarActividad } from '../../../../src/modules/micro-pausas/recomendacion.domain.js';

const act = (idActividad: number, duracionMin: number) => ({ idActividad, duracionMin });

describe('recomendarActividad (§7.2)', () => {
  it('elige la que mejor aprovecha la ventana entre las que caben', () => {
    const r = recomendarActividad(
      [act(1, 5), act(2, 8), act(3, 10), act(4, 12)],
      10,
      null,
      crearRng(1),
    );
    expect(r).toBe(3);
  });

  it('desempata con el PRNG: determinista con la misma semilla', () => {
    const candidatas = [act(1, 10), act(2, 10), act(3, 10), act(4, 5)];
    const elegidas = new Set(
      Array.from({ length: 20 }, (_, i) => recomendarActividad(candidatas, 10, null, crearRng(i))),
    );
    expect([...elegidas].every((id) => [1, 2, 3].includes(id!))).toBe(true);
    expect(elegidas.size).toBeGreaterThan(1);
    expect(recomendarActividad(candidatas, 10, null, crearRng(7))).toBe(
      recomendarActividad(candidatas, 10, null, crearRng(7)),
    );
  });

  it('evita repetir la última actividad si hay otra candidata', () => {
    expect(recomendarActividad([act(1, 10), act(2, 8)], 10, 1, crearRng(1))).toBe(2);
  });

  it('repite la última si es la única que cabe', () => {
    expect(recomendarActividad([act(1, 10), act(2, 12)], 10, 1, crearRng(1))).toBe(1);
  });

  it('sin candidatas que quepan → null', () => {
    expect(recomendarActividad([act(1, 6), act(2, 10)], 5, null, crearRng(1))).toBeNull();
    expect(recomendarActividad([], 15, null, crearRng(1))).toBeNull();
  });
});
