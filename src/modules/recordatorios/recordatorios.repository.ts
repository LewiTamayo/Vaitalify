import { prisma, type Prisma } from '../../common/db/prisma.js';
import { parseFecha } from '../../common/utils/dates.js';
import { aSkipTake } from '../../common/utils/pagination.js';
import { formatHHmm } from '../../common/utils/time.js';
import type { Config, Deseado } from './recordatorios.domain.js';

// Lecturas (solo) de micro-pausas y configuración: se consultan aquí para no crear ciclos de
// imports con los servicios que regeneran recordatorios tras sus cambios.

export async function pausasPendientes(idUsuario: number, fecha: string) {
  const filas = await prisma.microPausa.findMany({
    where: { estado: 'pendiente', ventana: { idUsuario, fecha: parseFecha(fecha) } },
    select: { ventana: { select: { horaInicio: true } }, actividad: { select: { nombre: true } } },
  });
  return filas.map((p) => ({
    horaInicio: formatHHmm(p.ventana.horaInicio),
    actividad: p.actividad.nombre,
  }));
}

export async function configs(idUsuario: number): Promise<Config[]> {
  const filas = await prisma.configNotificacion.findMany({ where: { idUsuario } });
  return filas.map((c) => ({
    tipo: c.tipo,
    activa: c.activa,
    silencioInicio: c.silencioInicio && formatHHmm(c.silencioInicio),
    silencioFin: c.silencioFin && formatHHmm(c.silencioFin),
  }));
}

export function enRango(idUsuario: number, desde: Date, hasta: Date) {
  return prisma.recordatorio.findMany({
    where: { idUsuario, fechaHoraEnvio: { gte: desde, lt: hasta } },
    select: { idRecordatorio: true, tipo: true, fechaHoraEnvio: true, enviado: true },
  });
}

export async function sincronizar(
  idUsuario: number,
  plan: { crear: Deseado[]; eliminar: number[] },
): Promise<void> {
  await prisma.$transaction([
    prisma.recordatorio.deleteMany({
      where: { idUsuario, enviado: false, idRecordatorio: { in: plan.eliminar } },
    }),
    prisma.recordatorio.createMany({
      data: plan.crear.map((d) => ({
        idUsuario,
        tipo: d.tipo,
        mensaje: d.mensaje,
        fechaHoraEnvio: d.fechaHoraEnvio,
      })),
      skipDuplicates: true,
    }),
  ]);
}

export async function listar(
  idUsuario: number,
  filtros: { tipo?: 'sueno' | 'pausa'; enviado?: boolean; desde?: Date; hasta?: Date },
  paginacion: { page: number; pageSize: number },
) {
  const where: Prisma.RecordatorioWhereInput = {
    idUsuario,
    tipo: filtros.tipo,
    enviado: filtros.enviado,
    fechaHoraEnvio: { gte: filtros.desde, lt: filtros.hasta },
  };
  const [filas, total] = await prisma.$transaction([
    prisma.recordatorio.findMany({
      where,
      orderBy: { fechaHoraEnvio: 'asc' },
      ...aSkipTake(paginacion),
    }),
    prisma.recordatorio.count({ where }),
  ]);
  return { filas, total };
}

export function pendientes(
  idUsuario: number,
  desde: Date,
  hasta: Date,
  tipos: ('sueno' | 'pausa')[],
) {
  return prisma.recordatorio.findMany({
    where: {
      idUsuario,
      enviado: false,
      tipo: { in: tipos },
      fechaHoraEnvio: { gte: desde, lte: hasta },
    },
    orderBy: { fechaHoraEnvio: 'asc' },
  });
}

export function buscar(idUsuario: number, idRecordatorio: number) {
  return prisma.recordatorio.findFirst({ where: { idRecordatorio, idUsuario } });
}

export async function actualizar(
  idUsuario: number,
  idRecordatorio: number,
  datos: Prisma.RecordatorioUpdateManyMutationInput,
) {
  const { count } = await prisma.recordatorio.updateMany({
    where: { idRecordatorio, idUsuario },
    data: datos,
  });
  return count > 0 ? buscar(idUsuario, idRecordatorio) : null;
}

export async function eliminar(idUsuario: number, idRecordatorio: number): Promise<boolean> {
  const { count } = await prisma.recordatorio.deleteMany({ where: { idRecordatorio, idUsuario } });
  return count > 0;
}

export type FilaRecordatorio = NonNullable<Awaited<ReturnType<typeof buscar>>>;
