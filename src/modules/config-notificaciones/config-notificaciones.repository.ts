import { prisma } from '../../common/db/prisma.js';
import { parseHHmm } from '../../common/utils/time.js';
import type { DatosConfig, Tipo } from './config-notificaciones.schemas.js';

const hora = (h: string | null) => (h === null ? null : parseHHmm(h));
const aFila = (d: DatosConfig) => ({
  activa: d.activa,
  silencioInicio: hora(d.silencioInicio),
  silencioFin: hora(d.silencioFin),
});

export const POR_DEFECTO: DatosConfig = { activa: true, silencioInicio: null, silencioFin: null };

export function listar(idUsuario: number) {
  // El orden del enum en PostgreSQL es el de declaración: sueno, pausa, logros.
  return prisma.configNotificacion.findMany({ where: { idUsuario }, orderBy: { tipo: 'asc' } });
}

export function buscar(idUsuario: number, tipo: Tipo) {
  return prisma.configNotificacion.findUnique({ where: { idUsuario_tipo: { idUsuario, tipo } } });
}

export function crear(idUsuario: number, tipo: Tipo, datos: DatosConfig) {
  return prisma.configNotificacion.create({ data: { idUsuario, tipo, ...aFila(datos) } });
}

export function actualizar(idUsuario: number, tipo: Tipo, datos: DatosConfig) {
  return prisma.configNotificacion.update({
    where: { idUsuario_tipo: { idUsuario, tipo } },
    data: aFila(datos),
  });
}

export function restablecer(idUsuario: number, tipo: Tipo) {
  return prisma.configNotificacion.upsert({
    where: { idUsuario_tipo: { idUsuario, tipo } },
    update: aFila(POR_DEFECTO),
    create: { idUsuario, tipo, ...aFila(POR_DEFECTO) },
  });
}

export type FilaConfig = NonNullable<Awaited<ReturnType<typeof buscar>>>;
