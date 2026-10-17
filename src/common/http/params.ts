import { z } from 'zod';

// Rango de INT de PostgreSQL: un id mayor haría fallar la consulta con un 500.
const MAX_INT = 2_147_483_647;

export const IdParamSchema = z.object({
  id: z.coerce
    .number('El id debe ser numérico')
    .int('El id debe ser un entero')
    .min(1, 'El id debe ser positivo')
    .max(MAX_INT, 'El id está fuera de rango'),
});
