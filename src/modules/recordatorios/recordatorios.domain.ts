import { DateTime } from 'luxon';
import { sumarDias } from '../../common/utils/dates.js';
import { aMinutos, deMinutos } from '../../common/utils/time.js';
import type { PlanSueno } from '../sueno/sueno.domain.js';

// Recordatorios de un día (§7.3, §7.7). Funciones puras: instantes en UTC calculados desde
// horas locales en la zona del usuario.

export type TipoRecordatorio = 'sueno' | 'pausa';

export interface Deseado {
  tipo: TipoRecordatorio;
  mensaje: string;
  fechaHoraEnvio: Date;
  // Después de este instante el recordatorio ya no tiene sentido (para el horario de silencio).
  limite: Date;
}

export interface Config {
  tipo: 'sueno' | 'pausa' | 'logros';
  activa: boolean;
  silencioInicio: string | null;
  silencioFin: string | null;
}

const MEDIODIA = 12 * 60;
const HORA_CORTE_DIA = '04:00';
const AVISO_PAUSA_MIN = 5;
const PANTALLAS_MIN = 30;

export function instanteDia(fecha: string, hora: string, zona: string): Date {
  return DateTime.fromISO(`${fecha}T${hora}`, { zone: zona }).toJSDate();
}

// Una hora "de la noche" anterior al mediodía (p. ej. 00:30) ya es el día siguiente.
export function instanteNoche(fecha: string, hora: string, zona: string): Date {
  const dia = aMinutos(hora) < MEDIODIA ? sumarDias(fecha, 1) : fecha;
  return instanteDia(dia, hora, zona);
}

export function ambitoDia(fecha: string, zona: string): { desde: Date; hasta: Date } {
  return {
    desde: instanteDia(fecha, HORA_CORTE_DIA, zona),
    hasta: instanteDia(sumarDias(fecha, 1), HORA_CORTE_DIA, zona),
  };
}

function recordatoriosDeSueno(fecha: string, plan: PlanSueno, zona: string): Deseado[] {
  const limite = instanteNoche(fecha, plan.despertar, zona);
  return [
    {
      tipo: 'sueno',
      mensaje: 'Deja las pantallas: en 30 minutos es hora de dormir',
      fechaHoraEnvio: instanteNoche(
        fecha,
        deMinutos(aMinutos(plan.acostarse) - PANTALLAS_MIN),
        zona,
      ),
      limite,
    },
    {
      tipo: 'sueno',
      mensaje: 'Hora de dormir para cumplir tu meta de sueño',
      fechaHoraEnvio: instanteNoche(fecha, plan.acostarse, zona),
      limite,
    },
  ];
}

export function recordatoriosDelDia(
  fecha: string,
  plan: PlanSueno | null,
  pausas: { horaInicio: string; actividad: string }[],
  zona: string,
): Deseado[] {
  const pausasDeseadas = pausas.map<Deseado>((p) => ({
    tipo: 'pausa',
    mensaje: `En 5 minutos: ${p.actividad}`,
    fechaHoraEnvio: instanteDia(fecha, deMinutos(aMinutos(p.horaInicio) - AVISO_PAUSA_MIN), zona),
    limite: instanteDia(fecha, p.horaInicio, zona),
  }));
  return [...(plan ? recordatoriosDeSueno(fecha, plan, zona) : []), ...pausasDeseadas];
}

function enSilencio(minuto: number, inicio: number, fin: number): boolean {
  return inicio < fin ? minuto >= inicio && minuto < fin : minuto >= inicio || minuto < fin;
}

// Fin del silencio que contiene el instante (puede ser al día siguiente si cruza medianoche).
function finDelSilencio(local: DateTime, inicio: number, fin: number): DateTime {
  const minuto = local.hour * 60 + local.minute;
  const diaSiguiente = inicio > fin && minuto >= inicio;
  const base = diaSiguiente ? local.plus({ days: 1 }) : local;
  return base.set({ hour: Math.floor(fin / 60), minute: fin % 60, second: 0, millisecond: 0 });
}

function respetarSilencio(d: Deseado, config: Config | undefined, zona: string): Deseado | null {
  if (!config?.silencioInicio || !config.silencioFin) return d;
  const inicio = aMinutos(config.silencioInicio);
  const fin = aMinutos(config.silencioFin);
  const local = DateTime.fromJSDate(d.fechaHoraEnvio, { zone: zona });
  if (!enSilencio(local.hour * 60 + local.minute, inicio, fin)) return d;
  const movido = finDelSilencio(local, inicio, fin).toJSDate();
  return movido.getTime() <= d.limite.getTime() ? { ...d, fechaHoraEnvio: movido } : null;
}

// Tipos inactivos fuera; en horario de silencio se mueven al final o se descartan si ya no sirven.
export function aplicarConfig(deseados: Deseado[], configs: Config[], zona: string): Deseado[] {
  const porTipo = new Map(configs.map((c) => [c.tipo, c]));
  return deseados
    .filter((d) => porTipo.get(d.tipo)?.activa ?? true)
    .map((d) => respetarSilencio(d, porTipo.get(d.tipo), zona))
    .filter((d): d is Deseado => d !== null);
}

interface Existente {
  idRecordatorio: number;
  tipo: TipoRecordatorio;
  fechaHoraEnvio: Date;
  enviado: boolean;
}

const clave = (r: { tipo: string; fechaHoraEnvio: Date }) =>
  `${r.tipo}|${r.fechaHoraEnvio.toISOString()}`;

// Idempotente: lo ya existente no se duplica; lo enviado nunca se borra.
export function planSincronizacion(
  existentes: Existente[],
  deseados: Deseado[],
): { crear: Deseado[]; eliminar: number[]; conservados: number } {
  const claves = new Set(deseados.map(clave));
  const existentesPorClave = new Set(existentes.map(clave));
  const eliminar = existentes
    .filter((e) => !e.enviado && !claves.has(clave(e)))
    .map((e) => e.idRecordatorio);
  return {
    crear: deseados.filter((d) => !existentesPorClave.has(clave(d))),
    eliminar,
    conservados: existentes.length - eliminar.length,
  };
}
