import type { DatosBloque } from '../src/modules/bloques/bloques.schemas.js';

// Datos deterministas del seed de rendimiento (spec §19.3), separados del script para
// poder probarlos sin base de datos.

export const correoPerf = (i: number): string => `perf_${String(i).padStart(4, '0')}@vitalify.test`;

const hh = (hora: number) => `${String(hora).padStart(2, '0')}:00`;

// Lunes a viernes: clases por la mañana (hasta las 9, 10 u 11) y trabajo por la tarde.
// Más 0 a 5 turnos de una hora el fin de semana, según el usuario: 10 a 15 bloques.
export function horarioPerf(i: number): DatosBloque[] {
  const finClases = 9 + (i % 3);
  const semana = [1, 2, 3, 4, 5].flatMap((diaSemana): DatosBloque[] => [
    { tipo: 'estudio', titulo: 'Clases', diaSemana, horaInicio: '07:00', horaFin: hh(finClases) },
    { tipo: 'trabajo', titulo: 'Trabajo', diaSemana, horaInicio: '14:00', horaFin: '18:00' },
  ]);
  const extras = Array.from({ length: i % 6 }, (_, k): DatosBloque => ({
    tipo: 'trabajo',
    titulo: `Turno extra ${k + 1}`,
    diaSemana: 6 + (k % 2),
    horaInicio: hh(8 + k * 2),
    horaFin: hh(9 + k * 2),
  }));
  return [...semana, ...extras];
}

export const lineasCsv = (correos: string[], contrasena: string): string =>
  ['correo,contrasena', ...correos.map((correo) => `${correo},${contrasena}`)].join('\n') + '\n';

// Regla de §7.2 sin el desempate aleatorio: la actividad que deja menos tiempo libre.
export function actividadQueCabe(
  actividades: ReadonlyArray<{ idActividad: number; duracionMin: number }>,
  duracionVentana: number,
): number | null {
  let mejor: { idActividad: number; duracionMin: number } | null = null;
  for (const a of actividades) {
    if (a.duracionMin <= duracionVentana && (!mejor || a.duracionMin > mejor.duracionMin))
      mejor = a;
  }
  return mejor?.idActividad ?? null;
}
