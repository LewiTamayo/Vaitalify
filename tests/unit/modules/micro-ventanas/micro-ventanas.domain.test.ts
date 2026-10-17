import { describe, expect, it } from 'vitest';
import { crearRng } from '../../../../src/common/utils/random.js';
import { aMinutos } from '../../../../src/common/utils/time.js';
import {
  detectarVentanasDia,
  diaDespierto,
  fusionar,
  planificarReconciliacion,
  type Intervalo,
  type VentanaCalculada,
  type VentanaExistente,
} from '../../../../src/modules/micro-ventanas/micro-ventanas.domain.js';

const b = (inicio: string, fin: string): Intervalo => ({
  inicio: aMinutos(inicio),
  fin: aMinutos(fin),
});
const DESPIERTO = diaDespierto('06:15', '22:45');

describe('diaDespierto', () => {
  it('intervalo normal', () => {
    expect(DESPIERTO).toEqual({ inicio: 375, fin: 1365 });
  });

  it('si se duerme después de medianoche, el día despierto termina a las 24:00', () => {
    expect(diaDespierto('06:00', '00:30')).toEqual({ inicio: 360, fin: 1440 });
  });
});

describe('fusionar', () => {
  it('une solapados y contiguos y ordena', () => {
    expect(fusionar([b('08:00', '09:00'), b('07:00', '08:00'), b('08:30', '10:00')])).toEqual([
      b('07:00', '10:00'),
    ]);
    expect(fusionar([b('12:00', '13:00'), b('07:00', '08:00')])).toEqual([
      b('07:00', '08:00'),
      b('12:00', '13:00'),
    ]);
  });
});

describe('detectarVentanasDia (casos obligatorios §11)', () => {
  it('sin bloques: una ventana de 15 min al despertar', () => {
    expect(detectarVentanasDia([], DESPIERTO)).toEqual([{ inicio: 375, duracionMin: 15 }]);
  });

  it('bloques solapados se fusionan', () => {
    expect(detectarVentanasDia([b('07:00', '09:00'), b('08:00', '10:00')], DESPIERTO)).toEqual([
      { inicio: 375, duracionMin: 15 },
      { inicio: 600, duracionMin: 15 },
    ]);
  });

  it('hueco de 4 min no genera ventana', () => {
    expect(detectarVentanasDia([b('06:19', '22:45')], DESPIERTO)).toEqual([]);
  });

  it('hueco de 40 min genera una ventana de 15', () => {
    expect(detectarVentanasDia([b('06:55', '22:45')], DESPIERTO)).toEqual([
      { inicio: 375, duracionMin: 15 },
    ]);
  });

  it('hueco de exactamente 5 min genera ventana de 5', () => {
    expect(detectarVentanasDia([b('06:20', '22:45')], DESPIERTO)).toEqual([
      { inicio: 375, duracionMin: 5 },
    ]);
  });

  it('un bloque que llena todo el día no deja ventanas', () => {
    expect(detectarVentanasDia([b('00:00', '23:59')], DESPIERTO)).toEqual([]);
  });

  it('bloques fuera del día despierto se recortan (sin huecos negativos)', () => {
    expect(detectarVentanasDia([b('05:00', '06:20'), b('22:00', '23:30')], DESPIERTO)).toEqual([
      { inicio: 380, duracionMin: 15 },
    ]);
    expect(detectarVentanasDia([b('01:00', '05:00')], DESPIERTO)).toEqual([
      { inicio: 375, duracionMin: 15 },
    ]);
  });

  it('rendimiento: 7 días con 30 bloques en menos de 200 ms (RNF-03)', () => {
    const rng = crearRng(1);
    const bloques = Array.from({ length: 30 }, () => {
      const inicio = Math.floor(rng() * 1380);
      return { inicio, fin: inicio + 5 + Math.floor(rng() * 55) };
    });
    const t0 = performance.now();
    for (let dia = 0; dia < 7; dia++) detectarVentanasDia(bloques, DESPIERTO);
    expect(performance.now() - t0).toBeLessThan(200);
  });
});

describe('planificarReconciliacion', () => {
  const calc = (fecha: string, horaInicio: string, duracionMin = 15): VentanaCalculada => ({
    fecha,
    horaInicio,
    duracionMin,
  });
  const exist = (
    idVentana: number,
    v: VentanaCalculada,
    pausa: VentanaExistente['pausa'] = null,
  ): VentanaExistente => ({ idVentana, ...v, pausa });

  it('conserva el historial (hecha/omitida) aunque ya no esté en el horario', () => {
    const plan = planificarReconciliacion(
      [
        exist(1, calc('2026-10-19', '07:00'), { estado: 'hecha', duracionActividad: 10 }),
        exist(2, calc('2026-10-19', '12:00'), { estado: 'omitida', duracionActividad: 5 }),
      ],
      [],
    );
    expect(plan).toEqual({ crear: [], eliminar: [], actualizarDuracion: [], conservadas: 2 });
  });

  it('elimina una pendiente cuya actividad ya no cabe y las ventanas sin pausa obsoletas', () => {
    const plan = planificarReconciliacion(
      [
        exist(1, calc('2026-10-19', '07:00'), { estado: 'pendiente', duracionActividad: 10 }),
        exist(2, calc('2026-10-19', '12:00')),
      ],
      [calc('2026-10-19', '07:00', 5)],
    );
    expect(plan.eliminar.toSorted((a, b) => a - b)).toEqual([1, 2]);
    // El hueco sigue existiendo (5 min): se crea una ventana nueva, sin pausa.
    expect(plan.crear).toEqual([calc('2026-10-19', '07:00', 5)]);
    expect(plan.conservadas).toBe(0);
  });

  it('conserva las coincidentes, actualiza la duración y crea las nuevas', () => {
    const plan = planificarReconciliacion(
      [
        exist(1, calc('2026-10-19', '07:00', 15)),
        exist(2, calc('2026-10-19', '09:00', 15), { estado: 'pendiente', duracionActividad: 5 }),
      ],
      [
        calc('2026-10-19', '07:00', 10),
        calc('2026-10-19', '09:00', 15),
        calc('2026-10-20', '07:00'),
      ],
    );
    expect(plan.crear).toEqual([calc('2026-10-20', '07:00')]);
    expect(plan.eliminar).toEqual([]);
    expect(plan.actualizarDuracion).toEqual([{ idVentana: 1, duracionMin: 10 }]);
    expect(plan.conservadas).toBe(2);
  });

  it('una calculada que coincide con una ventana de historial no se duplica', () => {
    const plan = planificarReconciliacion(
      [exist(1, calc('2026-10-19', '07:00'), { estado: 'hecha', duracionActividad: 10 })],
      [calc('2026-10-19', '07:00')],
    );
    expect(plan.crear).toEqual([]);
    expect(plan.conservadas).toBe(1);
  });
});
