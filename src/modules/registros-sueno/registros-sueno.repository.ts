import { prisma, type Prisma } from '../../common/db/prisma.js';
import { filtroFechas, parseFecha } from '../../common/utils/dates.js';
import { aSkipTake } from '../../common/utils/pagination.js';
import type { DatosRegistro, FiltrosRegistros } from './registros-sueno.schemas.js';

const aFila = (d: DatosRegistro) => ({
  fecha: parseFecha(d.fecha),
  horasDormidas: d.horasDormidas,
});

export function crear(idUsuario: number, datos: DatosRegistro) {
  return prisma.registroSueno.create({ data: { idUsuario, ...aFila(datos) } });
}

export async function listar(idUsuario: number, filtros: FiltrosRegistros) {
  const where: Prisma.RegistroSuenoWhereInput = {
    idUsuario,
    fecha: filtroFechas(filtros.desde, filtros.hasta),
  };
  const [filas, total] = await prisma.$transaction([
    prisma.registroSueno.findMany({ where, orderBy: { fecha: 'desc' }, ...aSkipTake(filtros) }),
    prisma.registroSueno.count({ where }),
  ]);
  return { filas, total };
}

export function buscar(idUsuario: number, idRegistro: number) {
  return prisma.registroSueno.findFirst({ where: { idRegistro, idUsuario } });
}

export async function reemplazar(idUsuario: number, idRegistro: number, datos: DatosRegistro) {
  const { count } = await prisma.registroSueno.updateMany({
    where: { idRegistro, idUsuario },
    data: aFila(datos),
  });
  return count > 0 ? buscar(idUsuario, idRegistro) : null;
}

export async function eliminar(idUsuario: number, idRegistro: number): Promise<boolean> {
  const { count } = await prisma.registroSueno.deleteMany({ where: { idRegistro, idUsuario } });
  return count > 0;
}

export type FilaRegistro = NonNullable<Awaited<ReturnType<typeof buscar>>>;
