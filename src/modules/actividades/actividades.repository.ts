import { prisma, type Prisma } from '../../common/db/prisma.js';
import { aSkipTake } from '../../common/utils/pagination.js';
import type { DatosActividad, FiltrosActividades } from './actividades.schemas.js';

export async function listar(filtros: FiltrosActividades) {
  const where: Prisma.ActividadWhereInput = {
    categoria: filtros.categoria,
    duracionMin: filtros.maxDuracionMin === undefined ? undefined : { lte: filtros.maxDuracionMin },
  };
  const [filas, total] = await prisma.$transaction([
    prisma.actividad.findMany({
      where,
      orderBy: [{ duracionMin: 'asc' }, { idActividad: 'asc' }],
      ...aSkipTake(filtros),
    }),
    prisma.actividad.count({ where }),
  ]);
  return { filas, total };
}

export function buscar(idActividad: number) {
  return prisma.actividad.findUnique({ where: { idActividad } });
}

export function crear(datos: DatosActividad) {
  return prisma.actividad.create({ data: datos });
}

export function actualizar(idActividad: number, datos: Partial<DatosActividad>) {
  return prisma.actividad.update({ where: { idActividad }, data: datos });
}

export function eliminar(idActividad: number) {
  return prisma.actividad.delete({ where: { idActividad } });
}

export function candidatas(maxDuracion: number) {
  return prisma.actividad.findMany({
    where: { duracionMin: { lte: maxDuracion } },
    select: { idActividad: true, duracionMin: true },
  });
}

export type FilaActividad = NonNullable<Awaited<ReturnType<typeof buscar>>>;
