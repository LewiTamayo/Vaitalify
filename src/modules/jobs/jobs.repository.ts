import { prisma } from '../../common/db/prisma.js';

// Página de usuarios con perfil (cursor por id) para procesar por lotes.
export async function usuariosConPerfil(despuesDe: number, tamano: number): Promise<number[]> {
  const filas = await prisma.perfilHabitos.findMany({
    where: { idUsuario: { gt: despuesDe } },
    orderBy: { idUsuario: 'asc' },
    take: tamano,
    select: { idUsuario: true },
  });
  return filas.map((f) => f.idUsuario);
}
