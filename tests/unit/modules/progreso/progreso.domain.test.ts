import { describe, expect, it } from 'vitest';
import {
  resumenActividad,
  resumenSueno,
  semanaDe,
} from '../../../../src/modules/progreso/progreso.domain.js';

describe('semanaDe', () => {
  it('lunes a domingo de la semana ISO', () => {
    expect(semanaDe('2026-10-08')).toEqual({ inicio: '2026-10-05', fin: '2026-10-11' });
    expect(semanaDe('2026-10-11')).toEqual({ inicio: '2026-10-05', fin: '2026-10-11' });
    expect(semanaDe('2026-10-12')).toEqual({ inicio: '2026-10-12', fin: '2026-10-18' });
  });
});

describe('resumenSueno (§7.5)', () => {
  it('promedia solo los días con registro (1 decimal)', () => {
    const r = resumenSueno(
      [
        { fecha: '2026-10-06', horas: 6.5 },
        { fecha: '2026-10-05', horas: 7 },
        { fecha: '2026-10-07', horas: 6.9 },
      ],
      7.5,
    );
    expect(r).toEqual({
      promedioHoras: 6.8,
      metaHoras: 7.5,
      porDia: [
        { fecha: '2026-10-05', horas: 7 },
        { fecha: '2026-10-06', horas: 6.5 },
        { fecha: '2026-10-07', horas: 6.9 },
      ],
    });
  });

  it('sin registros → promedio null', () => {
    expect(resumenSueno([], null)).toEqual({ promedioHoras: null, metaHoras: null, porDia: [] });
  });
});

describe('resumenActividad (§7.5)', () => {
  it('suma los minutos de las hechas y calcula el porcentaje de la meta', () => {
    const pausas = [
      ...Array.from({ length: 8 }, () => ({ estado: 'hecha' as const, duracionMin: 10 })),
      { estado: 'hecha' as const, duracionMin: 8 },
      { estado: 'hecha' as const, duracionMin: 8 },
      { estado: 'omitida' as const, duracionMin: 15 },
      { estado: 'pendiente' as const, duracionMin: 5 },
    ];
    expect(resumenActividad(pausas, 150)).toEqual({
      minutosAcumulados: 96,
      metaMinutos: 150,
      porcentajeMeta: 64,
      pausasHechas: 10,
      pausasOmitidas: 1,
    });
  });

  it('sin meta (sin perfil o meta 0) → porcentaje null', () => {
    expect(resumenActividad([], null).porcentajeMeta).toBeNull();
    expect(resumenActividad([], 0).porcentajeMeta).toBeNull();
  });
});
