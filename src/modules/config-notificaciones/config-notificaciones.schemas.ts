import { z } from 'zod';
import { registry } from '../../common/openapi/registry.js';
import { HoraSchema } from '../../common/utils/time.js';

export const TIPOS = ['sueno', 'pausa', 'logros'] as const;
const TipoSchema = z.enum(TIPOS);

export const TipoParamSchema = z.object({ tipo: TipoSchema });

const ConfigBaseSchema = z.object({
  activa: z.boolean(),
  silencioInicio: HoraSchema.nullable().openapi({ example: '22:00' }),
  silencioFin: HoraSchema.nullable().openapi({ example: '07:00' }),
});

type Silencio = { silencioInicio: string | null; silencioFin: string | null };

const ambosONinguno = (c: Silencio) => (c.silencioInicio === null) === (c.silencioFin === null);
const distintos = (c: Silencio) => c.silencioInicio === null || c.silencioInicio !== c.silencioFin;

function conReglasDeSilencio<T extends z.ZodType<Silencio>>(schema: T) {
  return schema
    .refine(ambosONinguno, {
      message: 'Envía silencioInicio y silencioFin juntos (o ambos en null)',
      path: ['silencioFin'],
    })
    .refine(distintos, {
      message: 'silencioFin debe ser distinto de silencioInicio',
      path: ['silencioFin'],
    });
}

// El horario de silencio puede cruzar medianoche (22:00 → 07:00).
export const ConfigSchema = conReglasDeSilencio(ConfigBaseSchema.strict());

export const CrearConfigSchema = conReglasDeSilencio(
  ConfigBaseSchema.extend({ tipo: TipoSchema }).strict(),
);

export const ConfigRespuestaSchema = registry.register(
  'ConfigNotificacion',
  ConfigBaseSchema.extend({ tipo: TipoSchema }),
);

export type Tipo = z.infer<typeof TipoSchema>;
export type DatosConfig = z.infer<typeof ConfigSchema>;
export type ConfigDto = z.infer<typeof ConfigRespuestaSchema>;
