import { prisma, type Prisma } from '../../common/db/prisma.js';
import { aSkipTake } from '../../common/utils/pagination.js';
import { parseHHmm } from '../../common/utils/time.js';
import type { DatosBloque, FiltrosBloques } from './bloques.schemas.js';

function aFila(datos: DatosBloque) {
  return {
    tipo: datos.tipo,
    titulo: datos.titulo,
    diaSemana: datos.diaSemana,
    horaInicio: parseHHmm(datos.horaInicio),
    horaFin: parseHHmm(datos.horaFin),
  };
}

export function crear(idUsuario: number, datos: DatosBloque) {
  return prisma.bloqueHorario.create({ data: { idUsuario, ...aFila(datos) } });
}

export async function listar(idUsuario: number, filtros: FiltrosBloques) {
  const where: Prisma.BloqueHorarioWhereInput = {
    idUsuario,
    tipo: filtros.tipo,
    diaSemana: filtros.diaSemana,
  };
  const [filas, total] = await prisma.$transaction([
    prisma.bloqueHorario.findMany({
      where,
      orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }, { idBloque: 'asc' }],
      ...aSkipTake(filtros),
    }),
    prisma.bloqueHorario.count({ where }),
  ]);
  return { filas, total };
}

// Una sola sentencia INSERT: o se guardan todos los bloques o ninguno.
export function importar(idUsuario: number, bloques: DatosBloque[]) {
  return prisma.bloqueHorario.createManyAndReturn({
    data: bloques.map((b) => ({ idUsuario, ...aFila(b), origen: 'importado' as const })),
  });
}

// Toda consulta por id incluye idUsuario: un bloque ajeno se comporta como inexistente.
export function buscar(idUsuario: number, idBloque: number) {
  return prisma.bloqueHorario.findFirst({ where: { idBloque, idUsuario } });
}

export async function reemplazar(idUsuario: number, idBloque: number, datos: DatosBloque) {
  const { count } = await prisma.bloqueHorario.updateMany({
    where: { idBloque, idUsuario },
    data: aFila(datos),
  });
  return count > 0 ? buscar(idUsuario, idBloque) : null;
}

export async function eliminar(idUsuario: number, idBloque: number): Promise<boolean> {
  const { count } = await prisma.bloqueHorario.deleteMany({ where: { idBloque, idUsuario } });
  return count > 0;
}

export type FilaBloque = NonNullable<Awaited<ReturnType<typeof buscar>>>;
