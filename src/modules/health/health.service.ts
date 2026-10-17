import { prisma } from '../../common/db/prisma.js';

// Comprueba la BD sin dejar colgada la función si Neon está suspendida o no responde.
export async function comprobarBaseDatos(timeoutMs = 3000): Promise<boolean> {
  let temporizador: NodeJS.Timeout | undefined;
  const limite = new Promise<boolean>((resolve) => {
    temporizador = setTimeout(() => resolve(false), timeoutMs);
  });
  const consulta = prisma.$queryRaw`SELECT 1`.then(
    () => true,
    () => false,
  );
  try {
    return await Promise.race([consulta, limite]);
  } finally {
    clearTimeout(temporizador);
  }
}
