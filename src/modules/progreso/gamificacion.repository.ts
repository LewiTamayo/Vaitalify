import type { Tx } from '../../common/db/bloqueos.js';
import { prisma } from '../../common/db/prisma.js';
import { formatFecha, parseFecha } from '../../common/utils/dates.js';
import type { EstadoRacha } from './gamificacion.domain.js';

// Lecturas (solo) de micro-pausas, registros de sueño y perfil: se consultan aquí para que los
// módulos que llaman a la gamificación no formen un ciclo de imports.

export async function diasActivos(idUsuario: number, db: Tx = prisma): Promise<string[]> {
  const filas = await db.microVentana.findMany({
    where: { idUsuario, microPausa: { estado: 'hecha' } },
    select: { fecha: true },
    distinct: ['fecha'],
  });
  return filas.map((f) => formatFecha(f.fecha));
}

export async function metaSueno(idUsuario: number, db: Tx = prisma): Promise<number | null> {
  const perfil = await db.perfilHabitos.findUnique({
    where: { idUsuario },
    select: { metaHorasSueno: true },
  });
  return perfil?.metaHorasSueno.toNumber() ?? null;
}

// Devuelve true si se otorgó ahora (false si ya estaba en el libro).
export async function otorgar(
  idUsuario: number,
  concepto: 'pausa' | 'sueno',
  referencia: string,
  puntos: number,
  db: Tx,
): Promise<boolean> {
  const { count } = await db.puntosOtorgados.createMany({
    data: [{ idUsuario, concepto, referencia, puntos }],
    skipDuplicates: true,
  });
  return count === 1;
}

export function pausasPuntuadas(idUsuario: number, db: Tx): Promise<number> {
  return db.puntosOtorgados.count({ where: { idUsuario, concepto: 'pausa' } });
}

export async function registrosSueno(idUsuario: number, db: Tx) {
  const filas = await db.registroSueno.findMany({
    where: { idUsuario },
    select: { fecha: true, horasDormidas: true },
  });
  return filas.map((r) => ({ fecha: formatFecha(r.fecha), horas: r.horasDormidas.toNumber() }));
}

export function catalogoInsignias(db: Tx) {
  return db.insignia.findMany({ select: { idInsignia: true, codigo: true, nombre: true } });
}

export async function insigniasObtenidas(idUsuario: number, db: Tx): Promise<string[]> {
  const filas = await db.usuarioInsignia.findMany({
    where: { idUsuario },
    select: { insignia: { select: { codigo: true } } },
  });
  return filas.map((f) => f.insignia.codigo);
}

export async function otorgarInsignias(
  idUsuario: number,
  ids: number[],
  hoy: string,
  db: Tx,
): Promise<void> {
  if (ids.length === 0) return;
  await db.usuarioInsignia.createMany({
    data: ids.map((idInsignia) => ({ idUsuario, idInsignia, fechaObtencion: parseFecha(hoy) })),
    skipDuplicates: true,
  });
}

// Progreso es una caché del cálculo (U-7): los puntos se acumulan y la racha se sobrescribe.
export async function guardarProgreso(
  idUsuario: number,
  puntosGanados: number,
  racha: EstadoRacha,
  db: Tx,
): Promise<void> {
  const datos = {
    rachaActual: racha.rachaActual,
    rachaMaxima: racha.rachaMaxima,
    diasComodin: racha.diasComodin,
    ultimaFechaActiva: racha.ultimaFechaActiva && parseFecha(racha.ultimaFechaActiva),
    semanaComodin: racha.semanaComodin,
  };
  await db.progreso.upsert({
    where: { idUsuario },
    update: { ...datos, puntosTotales: { increment: puntosGanados } },
    create: { idUsuario, ...datos, puntosTotales: puntosGanados },
  });
}
