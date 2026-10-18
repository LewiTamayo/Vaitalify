import { describe, expect, it } from 'vitest';
import {
  calcularRacha,
  insigniasMerecidas,
  maxNochesPorSemana,
  rachaVigente,
} from '../../../../src/modules/progreso/gamificacion.domain.js';

// 2026-10-05 es lunes (semana ISO W41); 2026-10-12 es lunes (W42).

describe('calcularRacha (§7.4, casos obligatorios §11)', () => {
  it('sin días activos', () => {
    expect(calcularRacha([])).toEqual({
      rachaActual: 0,
      rachaMaxima: 0,
      diasComodin: 2,
      ultimaFechaActiva: null,
      semanaComodin: null,
    });
  });

  it('primer día → racha 1', () => {
    expect(calcularRacha(['2026-10-05'])).toMatchObject({
      rachaActual: 1,
      rachaMaxima: 1,
      diasComodin: 2,
      ultimaFechaActiva: '2026-10-05',
      semanaComodin: '2026-W41',
    });
  });

  it('día consecutivo → racha 2', () => {
    expect(calcularRacha(['2026-10-05', '2026-10-06']).rachaActual).toBe(2);
  });

  it('1 día perdido con comodín → la racha sigue y se gasta un comodín', () => {
    expect(calcularRacha(['2026-10-05', '2026-10-07'])).toMatchObject({
      rachaActual: 2,
      diasComodin: 1,
    });
  });

  it('3 días perdidos con 2 comodines → reinicia a 1', () => {
    expect(calcularRacha(['2026-10-05', '2026-10-09'])).toMatchObject({
      rachaActual: 1,
      rachaMaxima: 1,
    });
  });

  it('el cambio de semana restablece los comodines (según la semana del nuevo día activo)', () => {
    // Sábado y domingo perdidos; el lunes es W42 → 2 comodines → la racha sigue.
    expect(calcularRacha(['2026-10-09', '2026-10-12'])).toMatchObject({
      rachaActual: 2,
      diasComodin: 0,
      semanaComodin: '2026-W42',
    });
    // Ya se había gastado un comodín en W41, pero el lunes de W42 vuelve a tener 2.
    expect(
      calcularRacha(['2026-10-05', '2026-10-07', '2026-10-08', '2026-10-10', '2026-10-12']),
    ).toMatchObject({
      rachaActual: 5,
      diasComodin: 1,
    });
  });

  it('dos registros del mismo día no cuentan dos veces', () => {
    expect(calcularRacha(['2026-10-05', '2026-10-05']).rachaActual).toBe(1);
  });

  it('llegada desordenada y sincronización tardía dan la misma racha que en orden (U-7)', () => {
    const enOrden = calcularRacha(['2026-10-05', '2026-10-06', '2026-10-07']);
    expect(calcularRacha(['2026-10-07', '2026-10-05', '2026-10-06'])).toEqual(enOrden);
  });

  it('la racha máxima se conserva tras un reinicio', () => {
    expect(calcularRacha(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-15'])).toMatchObject({
      rachaActual: 1,
      rachaMaxima: 3,
    });
  });
});

describe('rachaVigente', () => {
  const estado = calcularRacha(['2026-10-05']);

  it('mantiene la racha si los días perdidos hasta hoy caben en los comodines', () => {
    expect(rachaVigente(estado, '2026-10-05')).toEqual({ rachaActual: 1, comodinesRestantes: 2 });
    expect(rachaVigente(estado, '2026-10-07')).toEqual({ rachaActual: 1, comodinesRestantes: 1 });
  });

  it('una racha vieja (más días perdidos que comodines) ya no está vigente', () => {
    expect(rachaVigente(estado, '2026-10-09').rachaActual).toBe(0);
  });

  it('en una semana nueva cuentan 2 comodines', () => {
    const domingo = calcularRacha(['2026-10-04', '2026-10-09', '2026-10-10', '2026-10-11']);
    expect(rachaVigente(domingo, '2026-10-14')).toEqual({
      rachaActual: domingo.rachaActual,
      comodinesRestantes: 0,
    });
  });

  it('sin actividad → 0', () => {
    expect(rachaVigente(calcularRacha([]), '2026-10-09')).toEqual({
      rachaActual: 0,
      comodinesRestantes: 2,
    });
  });
});

describe('insignias (§7.6)', () => {
  const CATALOGO = ['PRIMERA_SEMANA', 'DIEZ_PAUSAS', 'SUENO_7H_5N', 'CREADA_POR_ADMIN'];
  const base = { diasActivos: 0, pausasPuntuadas: 0, maxNochesSuenoSemana: 0 };

  it('otorga las que cumplen su criterio y no repite las ya obtenidas', () => {
    expect(insigniasMerecidas({ ...base, diasActivos: 7 }, CATALOGO, [])).toEqual([
      'PRIMERA_SEMANA',
    ]);
    expect(insigniasMerecidas({ ...base, diasActivos: 7 }, CATALOGO, ['PRIMERA_SEMANA'])).toEqual(
      [],
    );
    expect(
      insigniasMerecidas(
        { diasActivos: 7, pausasPuntuadas: 10, maxNochesSuenoSemana: 5 },
        CATALOGO,
        [],
      ),
    ).toEqual(['PRIMERA_SEMANA', 'DIEZ_PAUSAS', 'SUENO_7H_5N']);
  });

  it('justo por debajo del umbral no se otorga; las del catálogo sin estrategia nunca', () => {
    expect(
      insigniasMerecidas(
        { diasActivos: 6, pausasPuntuadas: 9, maxNochesSuenoSemana: 4 },
        CATALOGO,
        [],
      ),
    ).toEqual([]);
    expect(insigniasMerecidas({ ...base, diasActivos: 7 }, ['DIEZ_PAUSAS'], [])).toEqual([]);
  });

  it('maxNochesPorSemana cuenta noches de ≥ 7 h por semana ISO', () => {
    const w41 = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'].map(
      (fecha) => ({
        fecha,
        horas: 7,
      }),
    );
    const w42 = ['2026-10-12', '2026-10-13'].map((fecha) => ({ fecha, horas: 8 }));
    expect(maxNochesPorSemana([...w41, ...w42, { fecha: '2026-10-14', horas: 6.5 }])).toBe(5);
    expect(maxNochesPorSemana([])).toBe(0);
  });
});
