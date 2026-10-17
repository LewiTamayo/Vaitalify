import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../db/prisma.js';

export function buscar(clave: string) {
  return prisma.idempotencyKey.findUnique({ where: { clave } });
}

// upsert: una clave vencida (> 24 h) se reutiliza sobrescribiendo la respuesta anterior.
export function guardar(clave: string, metodoRuta: string, codigo: number, respuesta: unknown) {
  const datos = {
    metodoRuta,
    codigo,
    respuesta: respuesta as Prisma.InputJsonValue,
    creadaEn: new Date(),
  };
  return prisma.idempotencyKey.upsert({
    where: { clave },
    update: datos,
    create: { clave, ...datos },
  });
}

// Para el job de limpieza (Fase 5).
export async function borrarAntiguas(antesDe: Date): Promise<number> {
  const { count } = await prisma.idempotencyKey.deleteMany({
    where: { creadaEn: { lt: antesDe } },
  });
  return count;
}
