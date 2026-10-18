import { z } from 'zod';
import { registry } from '../../common/openapi/registry.js';

const InsigniaBaseSchema = z.object({
  codigo: z
    .string()
    .regex(/^[A-Z0-9_]{1,40}$/, 'El código usa mayúsculas, números y guion bajo (máx. 40)')
    .openapi({ example: 'DIEZ_PAUSAS' }),
  nombre: z.string().trim().min(1).max(60).openapi({ example: '10 pausas' }),
  descripcion: z.string().trim().min(1).max(160),
  criterio: z.string().trim().min(1).max(120),
});

export const InsigniaSchema = InsigniaBaseSchema.strict();

export const InsigniaRespuestaSchema = registry.register(
  'Insignia',
  InsigniaBaseSchema.extend({ idInsignia: z.number().int() }),
);

export const InsigniaUsuarioSchema = registry.register(
  'InsigniaUsuario',
  InsigniaBaseSchema.extend({
    idInsignia: z.number().int(),
    obtenida: z.boolean(),
    fechaObtencion: z.string().nullable(),
  }),
);

export type DatosInsignia = z.infer<typeof InsigniaSchema>;
export type InsigniaDto = z.infer<typeof InsigniaRespuestaSchema>;
export type InsigniaUsuarioDto = z.infer<typeof InsigniaUsuarioSchema>;
