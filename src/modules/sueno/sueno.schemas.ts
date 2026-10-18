import { z } from 'zod';
import { registry } from '../../common/openapi/registry.js';
import { FechaSchema } from '../../common/utils/dates.js';

export const RecomendacionQuerySchema = z.object({
  fecha: FechaSchema.optional().openapi({ description: 'Noche a planificar (por defecto hoy)' }),
});

export const RecomendacionSuenoSchema = registry.register(
  'RecomendacionSueno',
  z.object({
    fecha: z.string(),
    horaSugeridaAcostarse: z.string().openapi({ example: '22:45' }),
    horaDespertar: z.string().openapi({ example: '06:15' }),
    primeraActividad: z.object({ titulo: z.string(), horaInicio: z.string() }).nullable(),
    horasDeSuenoLogradas: z.number().openapi({ example: 7.5 }),
    checklist: z.array(z.object({ texto: z.string(), hora: z.string().nullable() })),
  }),
);

export type RecomendacionSueno = z.infer<typeof RecomendacionSuenoSchema>;
