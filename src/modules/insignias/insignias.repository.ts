import { prisma } from '../../common/db/prisma.js';
import type { DatosInsignia } from './insignias.schemas.js';

export function catalogoConUsuario(idUsuario: number) {
  return prisma.insignia.findMany({
    orderBy: { idInsignia: 'asc' },
    include: { usuarios: { where: { idUsuario }, select: { fechaObtencion: true } } },
  });
}

export function crear(datos: DatosInsignia) {
  return prisma.insignia.create({ data: datos });
}

export function reemplazar(idInsignia: number, datos: DatosInsignia) {
  return prisma.insignia.update({ where: { idInsignia }, data: datos });
}

export function eliminar(idInsignia: number) {
  return prisma.insignia.delete({ where: { idInsignia } });
}
