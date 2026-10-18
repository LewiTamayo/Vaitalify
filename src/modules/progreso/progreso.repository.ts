import { prisma } from '../../common/db/prisma.js';
import { filtroFechas, formatFecha } from '../../common/utils/dates.js';

export function puntos(idUsuario: number) {
  return prisma.progreso.findUnique({ where: { idUsuario }, select: { puntosTotales: true } });
}

export async function metas(idUsuario: number) {
  const perfil = await prisma.perfilHabitos.findUnique({
    where: { idUsuario },
    select: { metaHorasSueno: true, metaMinActividad: true },
  });
  return {
    metaHoras: perfil?.metaHorasSueno.toNumber() ?? null,
    metaMinutos: perfil?.metaMinActividad ?? null,
  };
}

export async function registrosSueno(idUsuario: number, desde: string, hasta: string) {
  const filas = await prisma.registroSueno.findMany({
    where: { idUsuario, fecha: filtroFechas(desde, hasta) },
    select: { fecha: true, horasDormidas: true },
  });
  return filas.map((r) => ({ fecha: formatFecha(r.fecha), horas: r.horasDormidas.toNumber() }));
}

export async function pausas(idUsuario: number, desde: string, hasta: string) {
  const filas = await prisma.microPausa.findMany({
    where: { ventana: { idUsuario, fecha: filtroFechas(desde, hasta) } },
    select: { estado: true, actividad: { select: { duracionMin: true } } },
  });
  return filas.map((p) => ({ estado: p.estado, duracionMin: p.actividad.duracionMin }));
}

export async function insigniasDeLaSemana(idUsuario: number, desde: string, hasta: string) {
  const filas = await prisma.usuarioInsignia.findMany({
    where: { idUsuario, fechaObtencion: filtroFechas(desde, hasta) },
    select: { insignia: { select: { codigo: true, nombre: true } } },
    orderBy: { fechaObtencion: 'asc' },
  });
  return filas.map((f) => f.insignia);
}
