import { z } from 'zod';
import { registry } from '../../common/openapi/registry.js';
import { FechaSchema } from '../../common/utils/dates.js';
import { PaginacionSchema } from '../../common/utils/pagination.js';

export const MAX_DIAS_RECALCULO = 31;

export const RangoRecalculoSchema = z
  .object({
    desde: FechaSchema.optional().openapi({ example: '2026-10-19' }),
    hasta: FechaSchema.optional().openapi({ example: '2026-10-25' }),
  })
  .strict();

export const FiltrosVentanasSchema = PaginacionSchema.extend({
  desde: FechaSchema.optional(),
  hasta: FechaSchema.optional(),
  conPausa: z.stringbool().optional(),
});

const PausaResumenSchema = z.object({
  idPausa: z.number().int(),
  estado: z.enum(['pendiente', 'hecha', 'omitida']),
  actividad: z.object({
    idActividad: z.number().int(),
    nombre: z.string(),
    duracionMin: z.number().int(),
  }),
});

export const MicroVentanaSchema = registry.register(
  'MicroVentana',
  z.object({
    idVentana: z.number().int(),
    fecha: z.string().openapi({ example: '2026-10-19' }),
    horaInicio: z.string().openapi({ example: '06:15' }),
    duracionMin: z.number().int().openapi({ example: 15 }),
    microPausa: PausaResumenSchema.nullable(),
  }),
);

export const ResultadoRecalculoSchema = registry.register(
  'ResultadoRecalculo',
  z.object({
    generadas: z.number().int(),
    eliminadas: z.number().int(),
    conservadas: z.number().int(),
  }),
);

export type RangoRecalculo = z.infer<typeof RangoRecalculoSchema>;
export type FiltrosVentanas = z.infer<typeof FiltrosVentanasSchema>;
export type MicroVentanaDto = z.infer<typeof MicroVentanaSchema>;
export type ResultadoRecalculo = z.infer<typeof ResultadoRecalculoSchema>;
