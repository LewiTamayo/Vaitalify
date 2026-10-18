import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../db/prisma.js';

// codigo = 0 marca una petición en curso (clave reservada, aún sin respuesta).
export const EN_CURSO = 0;

export function buscar(clave: string) {
  return prisma.idempotencyKey.findUnique({ where: { clave } });
}

// Reserva atómica: si otra petición con la misma clave llegó primero, falla con P2002.
export function reservar(clave: string, metodoRuta: string) {
  return prisma.idempotencyKey.create({
    data: { clave, metodoRuta, codigo: EN_CURSO, respuesta: {} },
  });
}

export function completar(clave: string, codigo: number, respuesta: unknown) {
  return prisma.idempotencyKey.update({
    where: { clave },
    data: { codigo, respuesta: respuesta as Prisma.InputJsonValue },
  });
}

export async function liberar(clave: string): Promise<void> {
  await prisma.idempotencyKey.deleteMany({ where: { clave } });
}

export async function borrarVencida(clave: string, antesDe: Date): Promise<void> {
  await prisma.idempotencyKey.deleteMany({ where: { clave, creadaEn: { lt: antesDe } } });
}

// Para el job de limpieza (Fase 5).
export async function borrarAntiguas(antesDe: Date): Promise<number> {
  const { count } = await prisma.idempotencyKey.deleteMany({
    where: { creadaEn: { lt: antesDe } },
  });
  return count;
}
