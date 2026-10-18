import { describe, expect, it } from 'vitest';
import { BloqueSchema } from '../../../src/modules/bloques/bloques.schemas.js';
import {
  actividadQueCabe,
  correoPerf,
  horarioPerf,
  lineasCsv,
} from '../../../prisma/seed-perf-datos.js';

describe('datos del seed de rendimiento', () => {
  it('correoPerf numera con 4 dígitos', () => {
    expect(correoPerf(1)).toBe('perf_0001@vitalify.test');
    expect(correoPerf(123)).toBe('perf_0123@vitalify.test');
  });

  it('horarioPerf da de 10 a 15 bloques válidos por usuario', () => {
    for (let i = 1; i <= 50; i++) {
      const bloques = horarioPerf(i);
      expect(bloques.length).toBeGreaterThanOrEqual(10);
      expect(bloques.length).toBeLessThanOrEqual(15);
      for (const bloque of bloques) expect(BloqueSchema.safeParse(bloque).success).toBe(true);
    }
  });

  it('horarioPerf es determinista y varía entre usuarios', () => {
    expect(horarioPerf(7)).toEqual(horarioPerf(7));
    const tamanos = new Set([1, 2, 3, 4, 5, 6].map((i) => horarioPerf(i).length));
    expect(tamanos.size).toBe(6);
  });

  it('lineasCsv escribe la cabecera y una línea por usuario', () => {
    expect(lineasCsv(['a@x', 'b@x'], 'p')).toBe('correo,contrasena\na@x,p\nb@x,p\n');
  });
});

describe('actividadQueCabe', () => {
  const catalogo = [
    { idActividad: 1, duracionMin: 5 },
    { idActividad: 2, duracionMin: 10 },
    { idActividad: 3, duracionMin: 15 },
  ];

  it('elige la actividad que mejor aprovecha la ventana', () => {
    expect(actividadQueCabe(catalogo, 12)).toBe(2);
    expect(actividadQueCabe(catalogo, 15)).toBe(3);
  });

  it('sin actividad que quepa devuelve null', () => {
    expect(actividadQueCabe(catalogo, 4)).toBeNull();
  });
});
