import { prisma, type Prisma } from './prisma.js';

export type Tx = Prisma.TransactionClient;

// Espacios de nombres de los advisory locks: pg_advisory_xact_lock(clase, idUsuario).
const CLASES = { ventanas: 1, recordatorios: 2 } as const;

// Serializa por usuario operaciones que leen y reescriben datos derivados. El bloqueo vive lo que
// dura la transacción, así que funciona con el pooler de Neon (modo transacción) y entre
// instancias de Vercel.
function conBloqueo<T>(
  clase: keyof typeof CLASES,
  idUsuario: number,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CLASES[clase]}::int, ${idUsuario}::int)`;
      return fn(tx);
    },
    { timeout: 10_000, maxWait: 5_000 },
  );
}

// Recálculo de micro-ventanas y recomendación de micro-pausas.
export const conBloqueoVentanas = <T>(idUsuario: number, fn: (tx: Tx) => Promise<T>) =>
  conBloqueo('ventanas', idUsuario, fn);

// Generación de recordatorios.
export const conBloqueoRecordatorios = <T>(idUsuario: number, fn: (tx: Tx) => Promise<T>) =>
  conBloqueo('recordatorios', idUsuario, fn);
