import { z } from 'zod';
import { registry } from '../../common/openapi/registry.js';
import { FechaSchema } from '../../common/utils/dates.js';
import { PaginacionSchema } from '../../common/utils/pagination.js';

const TipoSchema = z.enum(['sueno', 'pausa']);

export const GenerarSchema = z.object({ fecha: FechaSchema.optional() }).strict();

export const FiltrosRecordatoriosSchema = PaginacionSchema.extend({
  tipo: TipoSchema.optional(),
  enviado: z.stringbool().optional(),
  desde: FechaSchema.optional(),
  hasta: FechaSchema.optional(),
});

export const MAX_HORAS_PENDIENTES = 72;

export const PendientesSchema = z.object({
  horas: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_HORAS_PENDIENTES, `horas no puede superar ${MAX_HORAS_PENDIENTES}`)
    .default(24),
});

export const ActualizarRecordatorioSchema = z
  .object({
    mensaje: z.string().trim().min(1).max(160).optional(),
    fechaHoraEnvio: z.iso.datetime({ offset: true }).optional(),
    enviado: z
      .literal(true)
      .optional()
      .openapi({ description: 'Acuse del cliente: la notificación local ya se programó' }),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'Envía al menos un campo' });

export const RecordatorioSchema = registry.register(
  'Recordatorio',
  z.object({
    idRecordatorio: z.number().int(),
    tipo: TipoSchema,
    mensaje: z.string(),
    fechaHoraEnvio: z.iso.datetime(),
    enviado: z.boolean(),
  }),
);

export const ResultadoGeneracionSchema = registry.register(
  'ResultadoGeneracion',
  z.object({
    generados: z.number().int(),
    eliminados: z.number().int(),
    conservados: z.number().int(),
  }),
);

export type FiltrosRecordatorios = z.infer<typeof FiltrosRecordatoriosSchema>;
export type ActualizarRecordatorio = z.infer<typeof ActualizarRecordatorioSchema>;
export type RecordatorioDto = z.infer<typeof RecordatorioSchema>;
export type ResultadoGeneracion = z.infer<typeof ResultadoGeneracionSchema>;
