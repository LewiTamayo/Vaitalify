import { prisma } from '../../common/db/prisma.js';
import { parseHHmm } from '../../common/utils/time.js';
import type { DatosPerfil } from './perfil.schemas.js';

function aFila(datos: DatosPerfil) {
  return {
    horaDormir: parseHHmm(datos.horaDormir),
    horaDespertar: parseHHmm(datos.horaDespertar),
    metaHorasSueno: datos.metaHorasSueno,
    metaMinActividad: datos.metaMinActividad,
  };
}

export function buscar(idUsuario: number) {
  return prisma.perfilHabitos.findUnique({ where: { idUsuario } });
}

export function crear(idUsuario: number, datos: DatosPerfil) {
  return prisma.perfilHabitos.create({ data: { idUsuario, ...aFila(datos) } });
}

export function actualizar(idUsuario: number, datos: DatosPerfil) {
  return prisma.perfilHabitos.update({ where: { idUsuario }, data: aFila(datos) });
}

export async function eliminar(idUsuario: number): Promise<boolean> {
  const { count } = await prisma.perfilHabitos.deleteMany({ where: { idUsuario } });
  return count > 0;
}

export type FilaPerfil = NonNullable<Awaited<ReturnType<typeof buscar>>>;
