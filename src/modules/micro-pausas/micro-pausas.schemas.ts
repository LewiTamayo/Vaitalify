import { z } from 'zod';
import { IdParamSchema } from '../../common/http/params.js';
import { registry } from '../../common/openapi/registry.js';
import { FechaSchema } from '../../common/utils/dates.js';
import { PaginacionSchema } from '../../common/utils/pagination.js';
import { ActividadRespuestaSchema } from '../actividades/actividades.schemas.js';

const EstadoSchema = z.enum(['pendiente', 'hecha', 'omitida']);

export const IdVentanaParamSchema = z.object({ idVentana: IdParamSchema.shape.id });

export const RecomendarSchema = z
  .object({
    idActividad: IdParamSchema.shape.id
      .optional()
      .openapi({ description: 'Opcional: fuerza una actividad (debe caber en la ventana)' }),
  })
  .strict();

export const CambiarEstadoSchema = z.object({ estado: EstadoSchema }).strict();

export const CambiarActividadSchema = z.object({ idActividad: IdParamSchema.shape.id }).strict();

export const FiltrosPausasSchema = PaginacionSchema.extend({
  estado: EstadoSchema.optional(),
  desde: FechaSchema.optional(),
  hasta: FechaSchema.optional(),
});

export const MicroPausaSchema = registry.register(
  'MicroPausa',
  z.object({
    idPausa: z.number().int(),
    estado: EstadoSchema,
    fechaRegistro: z.iso.datetime().nullable(),
    ventana: z.object({
      idVentana: z.number().int(),
      fecha: z.string(),
      horaInicio: z.string(),
      duracionMin: z.number().int(),
    }),
    actividad: ActividadRespuestaSchema,
  }),
);

export type Estado = z.infer<typeof EstadoSchema>;
export type FiltrosPausas = z.infer<typeof FiltrosPausasSchema>;
export type MicroPausaDto = z.infer<typeof MicroPausaSchema>;
