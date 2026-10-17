import { prisma, TipoConfigNotificacion, type Prisma } from '../../common/db/prisma.js';

const TIPOS_CONFIG = Object.values(TipoConfigNotificacion);

export interface NuevoUsuario {
  nombre: string;
  correo: string;
  contrasenaHash: string;
  aceptaDatos: boolean;
}

// Escritura anidada: usuario + progreso + 3 configuraciones en una sola sentencia atómica.
export function crearConDefaults(datos: NuevoUsuario) {
  return prisma.usuario.create({
    data: {
      ...datos,
      progreso: { create: {} },
      configs: { createMany: { data: TIPOS_CONFIG.map((tipo) => ({ tipo })) } },
    },
  });
}

export function buscarPorCorreo(correo: string) {
  return prisma.usuario.findUnique({ where: { correo } });
}

export function buscarPorId(idUsuario: number) {
  return prisma.usuario.findUnique({ where: { idUsuario } });
}

export function actualizar(idUsuario: number, datos: Prisma.UsuarioUpdateInput) {
  return prisma.usuario.update({ where: { idUsuario }, data: datos });
}

export async function eliminar(idUsuario: number): Promise<boolean> {
  const { count } = await prisma.usuario.deleteMany({ where: { idUsuario } });
  return count > 0;
}

export function cargarParaExportar(idUsuario: number) {
  return prisma.usuario.findUnique({
    where: { idUsuario },
    include: {
      perfil: true,
      bloques: { orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }] },
      microVentanas: {
        include: { microPausa: true },
        orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
      },
      registrosSueno: { orderBy: { fecha: 'asc' } },
      recordatorios: { orderBy: { fechaHoraEnvio: 'asc' } },
      configs: { orderBy: { tipo: 'asc' } },
      progreso: true,
      insignias: { include: { insignia: true } },
    },
  });
}

export type UsuarioConRelaciones = NonNullable<Awaited<ReturnType<typeof cargarParaExportar>>>;
