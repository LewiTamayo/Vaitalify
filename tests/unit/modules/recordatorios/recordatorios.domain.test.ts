import { describe, expect, it } from 'vitest';
import {
  ambitoDia,
  aplicarConfig,
  instanteDia,
  instanteNoche,
  planSincronizacion,
  recordatoriosDelDia,
  type Config,
  type Deseado,
} from '../../../../src/modules/recordatorios/recordatorios.domain.js';
import { calcularPlanSueno } from '../../../../src/modules/sueno/sueno.domain.js';

const ZONA = 'America/Bogota';
const D = '2026-10-19';
const PLAN = calcularPlanSueno(
  { horaDormir: '22:45', horaDespertar: '06:15', metaHorasSueno: 7.5 },
  [{ titulo: 'Clase', horaInicio: '07:00' }],
  45,
);
const iso = (d: Date) => d.toISOString();

const config = (tipo: Config['tipo'], cambios: Partial<Config> = {}): Config => ({
  tipo,
  activa: true,
  silencioInicio: null,
  silencioFin: null,
  ...cambios,
});
const TODAS = [config('sueno'), config('pausa'), config('logros')];

describe('instantes', () => {
  it('una hora de la noche anterior a las 12:00 pertenece al día siguiente', () => {
    expect(iso(instanteNoche(D, '00:30', ZONA))).toBe('2026-10-20T05:30:00.000Z');
    expect(iso(instanteNoche(D, '22:15', ZONA))).toBe('2026-10-20T03:15:00.000Z');
    expect(iso(instanteDia(D, '09:55', ZONA))).toBe('2026-10-19T14:55:00.000Z');
  });

  it('ámbito del día: [D 04:00, D+1 04:00) locales', () => {
    expect(ambitoDia(D, ZONA)).toEqual({
      desde: new Date('2026-10-19T09:00:00.000Z'),
      hasta: new Date('2026-10-20T09:00:00.000Z'),
    });
  });
});

describe('recordatoriosDelDia', () => {
  it('dos de sueño (acostarse − 30 y acostarse) y uno por pausa 5 min antes', () => {
    const r = recordatoriosDelDia(
      D,
      PLAN,
      [{ horaInicio: '10:00', actividad: 'Caminata corta' }],
      ZONA,
    );
    expect(r.map((x) => [x.tipo, iso(x.fechaHoraEnvio)])).toEqual([
      ['sueno', '2026-10-20T03:15:00.000Z'],
      ['sueno', '2026-10-20T03:45:00.000Z'],
      ['pausa', '2026-10-19T14:55:00.000Z'],
    ]);
    expect(r[2]!.mensaje).toContain('Caminata corta');
    expect(iso(r[0]!.limite)).toBe('2026-10-20T11:15:00.000Z'); // despertar 06:15 de D+1
    expect(iso(r[2]!.limite)).toBe('2026-10-19T15:00:00.000Z'); // inicio de la ventana
  });

  it('sin plan de sueño (sin perfil) solo hay recordatorios de pausa', () => {
    const r = recordatoriosDelDia(D, null, [{ horaInicio: '10:00', actividad: 'x' }], ZONA);
    expect(r.map((x) => x.tipo)).toEqual(['pausa']);
  });
});

describe('aplicarConfig', () => {
  const deseados = recordatoriosDelDia(
    D,
    PLAN,
    [
      { horaInicio: '07:00', actividad: 'a' },
      { horaInicio: '10:00', actividad: 'b' },
    ],
    ZONA,
  );

  it('un tipo inactivo no genera recordatorios', () => {
    const r = aplicarConfig(deseados, [config('sueno', { activa: false }), config('pausa')], ZONA);
    expect(r.every((x) => x.tipo === 'pausa')).toBe(true);
    expect(r).toHaveLength(2);
  });

  it('silencio que cruza medianoche: lo que se movería después de su límite se descarta', () => {
    const r = aplicarConfig(
      deseados,
      [
        config('sueno', { silencioInicio: '22:00', silencioFin: '07:00' }),
        config('pausa', { silencioInicio: '22:00', silencioFin: '07:30' }),
      ],
      ZONA,
    );
    // Sueño 22:15/22:45 → irían a las 07:00 de D+1, después del despertar (06:15): descartados.
    // Pausa 06:55 → iría a las 07:30, después del inicio de su ventana (07:00): descartada.
    expect(r.map((x) => iso(x.fechaHoraEnvio))).toEqual(['2026-10-19T14:55:00.000Z']);
  });

  it('si el fin del silencio aún es útil, el recordatorio se mueve al fin del silencio', () => {
    const r = aplicarConfig(
      deseados,
      [config('sueno'), config('pausa', { silencioInicio: '09:00', silencioFin: '09:58' })],
      ZONA,
    );
    const pausa10 = r.find((x) => x.mensaje.includes(': b'));
    expect(iso(pausa10!.fechaHoraEnvio)).toBe('2026-10-19T14:58:00.000Z');
  });

  it('sin configuración de un tipo se asume activo y sin silencio', () => {
    expect(aplicarConfig(deseados, [], ZONA)).toHaveLength(deseados.length);
    expect(aplicarConfig(deseados, TODAS, ZONA)).toHaveLength(deseados.length);
  });
});

describe('planSincronizacion', () => {
  const deseado = (tipo: Deseado['tipo'], instante: string): Deseado => ({
    tipo,
    mensaje: 'm',
    fechaHoraEnvio: new Date(instante),
    limite: new Date(instante),
  });
  const existente = (
    idRecordatorio: number,
    tipo: Deseado['tipo'],
    instante: string,
    enviado = false,
  ) => ({
    idRecordatorio,
    tipo,
    fechaHoraEnvio: new Date(instante),
    enviado,
  });

  it('conserva los iguales, crea los nuevos, elimina los obsoletos no enviados y nunca los enviados', () => {
    const plan = planSincronizacion(
      [
        existente(1, 'sueno', '2026-10-20T03:15:00Z'),
        existente(2, 'pausa', '2026-10-19T14:55:00Z'),
        existente(3, 'pausa', '2026-10-19T12:00:00Z', true),
      ],
      [deseado('sueno', '2026-10-20T03:15:00Z'), deseado('sueno', '2026-10-20T03:45:00Z')],
    );
    expect(plan.crear.map((d) => iso(d.fechaHoraEnvio))).toEqual(['2026-10-20T03:45:00.000Z']);
    expect(plan.eliminar).toEqual([2]);
    expect(plan.conservados).toBe(2);
  });
});
