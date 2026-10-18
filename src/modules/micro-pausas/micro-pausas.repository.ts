import { conBloqueoVentanas } from '../../common/db/bloqueos.js';
import { prisma, type EstadoMicroPausa, type Prisma } from '../../common/db/prisma.js';
import { parseFecha } from '../../common/utils/dates.js';
import { aSkipTake } from '../../common/utils/pagination.js';
import type { FiltrosPausas } from './micro-pausas.schemas.js';

const INCLUIR = { ventana: true, actividad: true } satisfies Prisma.MicroPausaInclude;
const ORDEN: Prisma.MicroPausaOrderByWithRelationInput[] = [
  { ventana: { fecha: 'asc' } },
  { ventana: { horaInicio: 'asc' } },
];

// La propiedad de una micro-pausa la da su ventana: toda consulta filtra por ventana.idUsuario.
const propia = (idUsuario: number, idPausa: number): Prisma.MicroPausaWhereInput => ({
  idPausa,
  ventana: { idUsuario },
});

export type ResultadoCrear = { idPausa: number } | 'sin-ventana' | 'no-cabe';

// Con el mismo bloqueo que el recálculo: la ventana se vuelve a leer dentro de la transacción,
// así no se asigna una pausa a una ventana que otro recálculo acaba de borrar o acortar.
export function crear(
  idUsuario: number,
  idVentana: number,
  idActividad: number,
  duracionActividad: number,
): Promise<ResultadoCrear> {
  return conBloqueoVentanas(idUsuario, async (tx) => {
    const ventana = await tx.microVentana.findFirst({ where: { idVentana, idUsuario } });
    if (!ventana) return 'sin-ventana';
    if (ventana.duracionMin < duracionActividad) return 'no-cabe';
    const { idPausa } = await tx.microPausa.create({ data: { idVentana, idActividad } });
    return { idPausa };
  });
}

export async function ultimaActividad(idUsuario: number): Promise<number | null> {
  const ultima = await prisma.microPausa.findFirst({
    where: { ventana: { idUsuario } },
    orderBy: { idPausa: 'desc' },
    select: { idActividad: true },
  });
  return ultima?.idActividad ?? null;
}

export function buscar(idUsuario: number, idPausa: number) {
  return prisma.microPausa.findFirst({ where: propia(idUsuario, idPausa), include: INCLUIR });
}

function filtroFechas(desde?: string, hasta?: string): Prisma.DateTimeFilter | undefined {
  if (!desde && !hasta) return undefined;
  return {
    gte: desde ? parseFecha(desde) : undefined,
    lte: hasta ? parseFecha(hasta) : undefined,
  };
}

export async function listar(idUsuario: number, filtros: FiltrosPausas) {
  const where: Prisma.MicroPausaWhereInput = {
    estado: filtros.estado,
    ventana: { idUsuario, fecha: filtroFechas(filtros.desde, filtros.hasta) },
  };
  const [filas, total] = await prisma.$transaction([
    prisma.microPausa.findMany({ where, include: INCLUIR, orderBy: ORDEN, ...aSkipTake(filtros) }),
    prisma.microPausa.count({ where }),
  ]);
  return { filas, total };
}

export function delDia(idUsuario: number, fecha: string) {
  return prisma.microPausa.findMany({
    where: { ventana: { idUsuario, fecha: parseFecha(fecha) } },
    include: INCLUIR,
    orderBy: ORDEN,
  });
}

export async function actualizar(
  idUsuario: number,
  idPausa: number,
  datos: { estado?: EstadoMicroPausa; fechaRegistro?: Date; idActividad?: number },
) {
  const { count } = await prisma.microPausa.updateMany({
    where: propia(idUsuario, idPausa),
    data: datos,
  });
  return count > 0 ? buscar(idUsuario, idPausa) : null;
}

export async function eliminar(idUsuario: number, idPausa: number): Promise<boolean> {
  const { count } = await prisma.microPausa.deleteMany({ where: propia(idUsuario, idPausa) });
  return count > 0;
}

export type FilaPausa = NonNullable<Awaited<ReturnType<typeof buscar>>>;
