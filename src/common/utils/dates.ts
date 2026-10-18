import { DateTime } from 'luxon';
import { z } from 'zod';
// Registra la extensión .openapi() de Zod antes de que otros módulos la usen sobre FechaSchema.
import '../openapi/registry.js';

// Fechas del usuario: "YYYY-MM-DD" locales (sin zona). "Hoy" siempre se calcula en APP_TZ
// porque Vercel corre en UTC (entre 19:00 y 23:59 de Bogotá, UTC ya es el día siguiente).

export const APP_TZ_DEFAULT = 'America/Bogota';

function aDateTime(fecha: string): DateTime {
  const dt = DateTime.fromISO(fecha, { zone: 'utc' });
  if (!dt.isValid || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new Error(`Fecha inválida: se esperaba YYYY-MM-DD (${fecha})`);
  }
  return dt;
}

function aTexto(dt: DateTime): string {
  return dt.toFormat('yyyy-MM-dd');
}

export function hoyEnZona(
  zona: string = process.env.APP_TZ ?? APP_TZ_DEFAULT,
  ahora: DateTime = DateTime.utc(),
): string {
  return aTexto(ahora.setZone(zona));
}

export function isoWeekday(fecha: string): number {
  return aDateTime(fecha).weekday;
}

export function semanaIso(fecha: string): string {
  return aDateTime(fecha).toFormat("kkkk-'W'WW");
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round(aDateTime(hasta).diff(aDateTime(desde), 'days').days);
}

export function sumarDias(fecha: string, n: number): string {
  return aTexto(aDateTime(fecha).plus({ days: n }));
}

export function rangoFechas(desde: string, hasta: string): string[] {
  const total = diasEntre(desde, hasta);
  return Array.from({ length: Math.max(total + 1, 0) }, (_, i) => sumarDias(desde, i));
}

export function parseFecha(fecha: string): Date {
  return aDateTime(fecha).toJSDate();
}

export function formatFecha(d: Date): string {
  return aTexto(DateTime.fromJSDate(d, { zone: 'utc' }));
}

// Fecha local "YYYY-MM-DD" que además debe existir en el calendario (rechaza 2026-02-30).
export const FechaSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida: usa el formato YYYY-MM-DD')
  .refine((fecha) => DateTime.fromISO(fecha, { zone: 'utc' }).isValid, 'La fecha no existe');

// Filtro de Prisma para columnas @db.Date con un rango opcional de fechas locales.
export function filtroFechas(
  desde?: string,
  hasta?: string,
): { gte?: Date; lte?: Date } | undefined {
  if (!desde && !hasta) return undefined;
  return {
    gte: desde ? parseFecha(desde) : undefined,
    lte: hasta ? parseFecha(hasta) : undefined,
  };
}

// Día lógico de los recordatorios: corta a las 04:00 locales. Entre las 00:00 y las 04:00 todavía
// es "la noche de ayer" (sus recordatorios de sueño pertenecen al día anterior).
export const HORAS_CORTE_DIA_LOGICO = 4;

export function diaLogico(
  zona: string = process.env.APP_TZ ?? APP_TZ_DEFAULT,
  ahora: DateTime = DateTime.utc(),
): string {
  return hoyEnZona(zona, ahora.minus({ hours: HORAS_CORTE_DIA_LOGICO }));
}
