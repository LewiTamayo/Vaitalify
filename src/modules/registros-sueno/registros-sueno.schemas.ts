import { z } from 'zod';
import { registry } from '../../common/openapi/registry.js';
import { FechaSchema } from '../../common/utils/dates.js';
import { PaginacionSchema } from '../../common/utils/pagination.js';

export const RegistroSuenoSchema = z
  .object({
    fecha: FechaSchema.openapi({ example: '2026-10-19', description: 'Fecha del despertar' }),
    horasDormidas: z
      .number()
      .min(0, 'horasDormidas debe estar entre 0 y 16')
      .max(16, 'horasDormidas debe estar entre 0 y 16')
      .multipleOf(0.5, 'horasDormidas va en pasos de 0.5')
      .openapi({ example: 7.5 }),
  })
  .strict();

export const FiltrosRegistrosSchema = PaginacionSchema.extend({
  desde: FechaSchema.optional(),
  hasta: FechaSchema.optional(),
});

export const RegistroSuenoRespuestaSchema = registry.register(
  'RegistroSueno',
  z.object({
    idRegistro: z.number().int(),
    fecha: z.string(),
    horasDormidas: z.number(),
  }),
);

export type DatosRegistro = z.infer<typeof RegistroSuenoSchema>;
export type FiltrosRegistros = z.infer<typeof FiltrosRegistrosSchema>;
export type RegistroSuenoDto = z.infer<typeof RegistroSuenoRespuestaSchema>;
