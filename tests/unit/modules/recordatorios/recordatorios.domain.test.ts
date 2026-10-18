import { describe, expect, it } from 'vitest';
import {
  aplicarConfig,
  instanteDia,
  planSincronizacion,
  recordatoriosDelDia,
  type Config,
  type Deseado,
} from '../../../../src/modules/recordatorios/recordatorios.domain.js';
import { calcularPlanSueno } from '../../../../src/modules/sueno/sueno.domain.js';

const ZONA = 'America/Bogota';
const D = '2026-10-19';
const PERFIL = { horaDormir: '22:45', horaDespertar: '06:15', metaHorasSueno: 7.5 };
const PLAN = calcularPlanSueno(PERFIL, [{ titulo: 'Clase', horaInicio: '07:00' }], 45);
const iso = (d: Date) => d.toISOString();

const config = (tipo: Config['tipo'], cambios: Partial<Config> = {}): Config => ({
  tipo,
  activa: true,
  silencioInicio: null,
  silencioFin: null,
  ...cambios,
});
const TODAS = [config('sueno'), config('pausa'), config('logros')];

describe('instanteDia', () => {
  it('hora local de una fecha en la zona del usuario', () => {
    expect(iso(instanteDia(D, '09:55', ZONA))).toBe('2026-10-19T14:55:00.000Z');
  });
});

describe('recordatoriosDelDia', () => {
  it('dos de sueño (acostarse − 30 y acostarse) y uno por pausa 5 min antes, todos del día D', () => {
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
    expect(r.every((x) => x.fecha === D)).toBe(true);
    expect(r[2]!.mensaje).toContain('Caminata corta');
    expect(iso(r[0]!.limite)).toBe('2026-10-20T11:15:00.000Z'); // despertar 06:15 de D+1
    expect(iso(r[2]!.limite)).toBe('2026-10-19T15:00:00.000Z'); // inicio de la ventana
  });

  it('la clave de origen identifica el recordatorio por tipo e instante generado', () => {
    const [primero] = recordatoriosDelDia(D, PLAN, [], ZONA);
    expect(primero!.claveOrigen).toBe('sueno|2026-10-20T03:15:00.000Z');
  });

  it('día que empieza por la tarde: acostarse 05:45 de D+1 y límite en el despertar de D+1', () => {
    const tarde = calcularPlanSueno(PERFIL, [{ titulo: 'Turno', horaInicio: '14:00' }], 45);
    expect(tarde.acostarse).toBe('05:45');
    const [pantallas, dormir] = recordatoriosDelDia(D, tarde, [], ZONA);
    expect(iso(pantallas!.fechaHoraEnvio)).toBe('2026-10-20T10:15:00.000Z'); // 05:15 de D+1
    expect(iso(dormir!.fechaHoraEnvio)).toBe('2026-10-20T10:45:00.000Z'); // 05:45 de D+1
    expect(iso(dormir!.limite)).toBe('2026-10-20T18:15:00.000Z'); // 13:15 de D+1
    expect(dormir!.fecha).toBe(D);
  });

  it('acostarse después de medianoche (00:30) cae en D+1', () => {
    const tarde = calcularPlanSueno({ ...PERFIL, horaDormir: '00:30' }, [], 45);
    const [, dormir] = recordatoriosDelDia(D, tarde, [], ZONA);
    expect(iso(dormir!.fechaHoraEnvio)).toBe('2026-10-20T05:30:00.000Z');
  });

  it('una pausa a las 00:02 avisa 5 min antes (23:57 del día anterior), no después', () => {
    const [aviso] = recordatoriosDelDia(D, null, [{ horaInicio: '00:02', actividad: 'x' }], ZONA);
    expect(iso(aviso!.fechaHoraEnvio)).toBe('2026-10-19T04:57:00.000Z');
    expect(aviso!.fechaHoraEnvio.getTime()).toBeLessThan(aviso!.limite.getTime());
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

  it('si el fin del silencio aún es útil, se mueve y conserva su clave de origen', () => {
    const r = aplicarConfig(
      deseados,
      [config('sueno'), config('pausa', { silencioInicio: '09:00', silencioFin: '09:58' })],
      ZONA,
    );
    const pausa10 = r.find((x) => x.mensaje.includes(': b'));
    expect(iso(pausa10!.fechaHoraEnvio)).toBe('2026-10-19T14:58:00.000Z');
    expect(pausa10!.claveOrigen).toBe('pausa|2026-10-19T14:55:00.000Z');
  });

  it('día de tarde con silencio 05:00→06:00: el sueño se mueve a las 06:00 (antes del despertar)', () => {
    const tarde = calcularPlanSueno(PERFIL, [{ titulo: 'Turno', horaInicio: '14:00' }], 45);
    const r = aplicarConfig(
      recordatoriosDelDia(D, tarde, [], ZONA),
      [config('sueno', { silencioInicio: '05:00', silencioFin: '06:00' })],
      ZONA,
    );
    expect(r.map((x) => iso(x.fechaHoraEnvio))).toEqual([
      '2026-10-20T11:00:00.000Z',
      '2026-10-20T11:00:00.000Z',
    ]);
  });

  it('sin configuración de un tipo se asume activo y sin silencio', () => {
    expect(aplicarConfig(deseados, [], ZONA)).toHaveLength(deseados.length);
    expect(aplicarConfig(deseados, TODAS, ZONA)).toHaveLength(deseados.length);
  });
});

describe('planSincronizacion (por clave de origen)', () => {
  const deseado = (claveOrigen: string): Deseado => ({
    tipo: 'sueno',
    fecha: D,
    claveOrigen,
    mensaje: 'm',
    fechaHoraEnvio: new Date(claveOrigen.split('|')[1]!),
    limite: new Date(claveOrigen.split('|')[1]!),
  });
  const existente = (idRecordatorio: number, claveOrigen: string, enviado = false) => ({
    idRecordatorio,
    claveOrigen,
    enviado,
  });

  it('conserva los iguales, crea los nuevos, elimina los obsoletos no enviados y nunca los enviados', () => {
    const plan = planSincronizacion(
      [
        existente(1, 'sueno|2026-10-20T03:15:00.000Z'),
        existente(2, 'pausa|2026-10-19T14:55:00.000Z'),
        existente(3, 'pausa|2026-10-19T12:00:00.000Z', true),
      ],
      [deseado('sueno|2026-10-20T03:15:00.000Z'), deseado('sueno|2026-10-20T03:45:00.000Z')],
    );
    expect(plan.crear.map((d) => d.claveOrigen)).toEqual(['sueno|2026-10-20T03:45:00.000Z']);
    expect(plan.eliminar).toEqual([2]);
    expect(plan.conservados).toBe(2);
  });

  it('un recordatorio editado (otra hora, misma clave de origen) se conserva y no se recrea', () => {
    const plan = planSincronizacion(
      [existente(1, 'sueno|2026-10-20T03:15:00.000Z')],
      [deseado('sueno|2026-10-20T03:15:00.000Z')],
    );
    expect(plan).toEqual({ crear: [], eliminar: [], conservados: 1 });
  });
});
