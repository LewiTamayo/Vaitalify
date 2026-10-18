import { DateTime } from 'luxon';
import { sumarDias } from '../../common/utils/dates.js';
import { aMinutos } from '../../common/utils/time.js';
import type { PlanSueno } from '../sueno/sueno.domain.js';

// Recordatorios de un día lógico D (§7.3, §7.7). Funciones puras: instantes en UTC calculados
// desde horas locales en la zona del usuario.

export type TipoRecordatorio = 'sueno' | 'pausa';

export interface Deseado {
  tipo: TipoRecordatorio;
  // Día lógico al que pertenece (la noche de D, aunque se envíe en la madrugada de D+1).
  fecha: string;
  // tipo|instante generado: identifica el recordatorio aunque el usuario edite su hora.
  claveOrigen: string;
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

const MINUTOS_DIA = 1440;
const AVISO_PAUSA_MIN = 5;
const PANTALLAS_MIN = 30;

export function instanteDia(fecha: string, hora: string, zona: string): Date {
  return DateTime.fromISO(`${fecha}T${hora}`, { zone: zona }).toJSDate();
}

const menosMinutos = (d: Date, minutos: number) => new Date(d.getTime() - minutos * 60_000);

function nuevo(datos: Omit<Deseado, 'claveOrigen'>): Deseado {
  return { ...datos, claveOrigen: `${datos.tipo}|${datos.fechaHoraEnvio.toISOString()}` };
}

// El despertar es siempre en D+1, salvo que la primera actividad sea justo después de medianoche
// y el despertar caiga todavía en D (p. ej. actividad 00:30 → despertar 23:45 de D).
function instanteDespertar(fecha: string, plan: PlanSueno, zona: string): Date {
  const primera = plan.primeraActividad;
  const antesDeMedianoche =
    primera !== null && aMinutos(plan.despertar) > aMinutos(primera.horaInicio);
  return instanteDia(antesDeMedianoche ? fecha : sumarDias(fecha, 1), plan.despertar, zona);
}

// Los instantes de sueño se anclan al despertar y se calculan hacia atrás: así una hora de
// acostarse de madrugada (día que empieza por la tarde) cae en D+1 y nunca en el día equivocado.
function recordatoriosDeSueno(fecha: string, plan: PlanSueno, zona: string): Deseado[] {
  const despertar = instanteDespertar(fecha, plan, zona);
  const minutosDeSueno =
    (aMinutos(plan.despertar) - aMinutos(plan.acostarse) + MINUTOS_DIA) % MINUTOS_DIA ||
    MINUTOS_DIA;
  const acostarse = menosMinutos(despertar, minutosDeSueno);
  return [
    nuevo({
      tipo: 'sueno',
      fecha,
      mensaje: 'Deja las pantallas: en 30 minutos es hora de dormir',
      fechaHoraEnvio: menosMinutos(acostarse, PANTALLAS_MIN),
      limite: despertar,
    }),
    nuevo({
      tipo: 'sueno',
      fecha,
      mensaje: 'Hora de dormir para cumplir tu meta de sueño',
      fechaHoraEnvio: acostarse,
      limite: despertar,
    }),
  ];
}

export function recordatoriosDelDia(
  fecha: string,
  plan: PlanSueno | null,
  pausas: { horaInicio: string; actividad: string }[],
  zona: string,
): Deseado[] {
  const pausasDeseadas = pausas.map((p) => {
    const inicio = instanteDia(fecha, p.horaInicio, zona);
    return nuevo({
      tipo: 'pausa',
      fecha,
      mensaje: `En 5 minutos: ${p.actividad}`,
      fechaHoraEnvio: menosMinutos(inicio, AVISO_PAUSA_MIN),
      limite: inicio,
    });
  });
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
  // Se mueve conservando su clave de origen: sigue siendo "el mismo" recordatorio.
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
  claveOrigen: string;
  enviado: boolean;
}

// Idempotente y por clave de origen: lo ya existente (aunque el usuario haya editado su hora) no
// se duplica ni se recrea; lo enviado nunca se borra.
export function planSincronizacion(
  existentes: Existente[],
  deseados: Deseado[],
): { crear: Deseado[]; eliminar: number[]; conservados: number } {
  const deseadas = new Set(deseados.map((d) => d.claveOrigen));
  const existentesPorClave = new Set(existentes.map((e) => e.claveOrigen));
  const eliminar = existentes
    .filter((e) => !e.enviado && !deseadas.has(e.claveOrigen))
    .map((e) => e.idRecordatorio);
  return {
    crear: deseados.filter((d) => !existentesPorClave.has(d.claveOrigen)),
    eliminar,
    conservados: existentes.length - eliminar.length,
  };
}
