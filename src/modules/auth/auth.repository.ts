import { prisma } from '../../common/db/prisma.js';

export function guardarRefresh(idUsuario: number, tokenHash: string, expiraEn: Date) {
  return prisma.refreshToken.create({ data: { idUsuario, tokenHash, expiraEn } });
}

export function buscarRefresh(tokenHash: string) {
  return prisma.refreshToken.findUnique({ where: { tokenHash } });
}

// Revocación condicional: si dos peticiones rotan el mismo token a la vez, solo una gana.
export async function revocarRefresh(idToken: number): Promise<boolean> {
  const { count } = await prisma.refreshToken.updateMany({
    where: { idToken, revocado: false },
    data: { revocado: true },
  });
  return count === 1;
}

export async function revocarTodos(idUsuario: number): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { idUsuario, revocado: false },
    data: { revocado: true },
  });
}
