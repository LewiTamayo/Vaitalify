import { prisma, type Prisma } from './prisma.js';

export type Tx = Prisma.TransactionClient;

// Espacio de nombres del advisory lock (pg_advisory_xact_lock(clase, id)): micro-ventanas.
const CLASE_VENTANAS = 1;

// Serializa por usuario las operaciones que leen y reescriben sus micro-ventanas (recálculo y
// recomendación). El bloqueo vive lo que dura la transacción, así que también funciona con el
// pooler de Neon (modo transacción) y entre instancias de Vercel.
export function conBloqueoVentanas<T>(idUsuario: number, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CLASE_VENTANAS}::int, ${idUsuario}::int)`;
      return fn(tx);
    },
    { timeout: 10_000, maxWait: 5_000 },
  );
}
