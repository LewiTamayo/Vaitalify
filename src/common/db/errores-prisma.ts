import { Prisma } from './prisma.js';

function tieneCodigo(error: unknown, codigo: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === codigo;
}

// Restricción UNIQUE violada.
export const esUnicoViolado = (error: unknown) => tieneCodigo(error, 'P2002');

// Registro a actualizar/borrar no encontrado.
export const esNoEncontrado = (error: unknown) => tieneCodigo(error, 'P2025');

// Clave foránea violada (p. ej. borrar una actividad con micro-pausas, onDelete: Restrict).
export const esFkViolada = (error: unknown) => tieneCodigo(error, 'P2003');
