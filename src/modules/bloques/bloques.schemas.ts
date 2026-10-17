import { z } from 'zod';
import { errores } from '../../common/errors/app-error.js';
import { erroresDeZod } from '../../common/errors/zod-errors.js';
import { registry } from '../../common/openapi/registry.js';
import { PaginacionSchema } from '../../common/utils/pagination.js';
import { HoraSchema } from '../../common/utils/time.js';

const TipoSchema = z.enum(['trabajo', 'estudio', 'viaje']);
const DiaSemanaSchema = z
  .number()
  .int()
  .min(1, 'diaSemana va de 1 (lunes) a 7 (domingo)')
  .max(7, 'diaSemana va de 1 (lunes) a 7 (domingo)')
  .openapi({ example: 2, description: '1 = lunes … 7 = domingo (ISO)' });

const BloqueBaseSchema = z.object({
  tipo: TipoSchema,
  titulo: z
    .string()
    .trim()
    .min(1, 'El título es obligatorio')
    .max(80, 'El título no puede superar 80 caracteres')
    .openapi({ example: 'Clase de Cálculo' }),
  diaSemana: DiaSemanaSchema,
  horaInicio: HoraSchema,
  horaFin: HoraSchema.openapi({ example: '09:00' }),
});

// "HH:mm" con ceros a la izquierda se ordena bien como texto; no lanza aunque la hora sea
// inválida (Zod ejecuta este refinamiento aunque el formato ya haya fallado).
const horasEnOrden = (b: { horaInicio: string; horaFin: string }) => b.horaFin > b.horaInicio;
const ERROR_ORDEN = {
  message:
    'horaFin debe ser posterior a horaInicio (los bloques no cruzan medianoche; usa dos bloques)',
  path: ['horaFin'],
};

export const BloqueSchema = BloqueBaseSchema.strict().refine(horasEnOrden, ERROR_ORDEN);

export const BloqueParcialSchema = BloqueBaseSchema.partial()
  .strict()
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Envía al menos un campo para actualizar',
  });

export const FiltrosBloquesSchema = PaginacionSchema.extend({
  tipo: TipoSchema.optional(),
  diaSemana: z.coerce.number().pipe(DiaSemanaSchema).optional(),
});

export const MAX_IMPORTACION = 200;

export const ImportarBloquesSchema = z
  .object({
    bloques: z
      .array(BloqueSchema)
      .min(1, 'Envía al menos un bloque')
      .max(MAX_IMPORTACION, `Se pueden importar como máximo ${MAX_IMPORTACION} bloques por lote`),
  })
  .strict();

export const BloqueRespuestaSchema = registry.register(
  'Bloque',
  BloqueBaseSchema.extend({
    idBloque: z.number().int(),
    origen: z.enum(['manual', 'importado']),
  }),
);

export type DatosBloque = z.infer<typeof BloqueSchema>;
export type DatosBloqueParcial = z.infer<typeof BloqueParcialSchema>;
export type FiltrosBloques = z.infer<typeof FiltrosBloquesSchema>;
export type ImportarBloques = z.infer<typeof ImportarBloquesSchema>;
export type BloqueDto = z.infer<typeof BloqueRespuestaSchema>;

export const ImportacionRespuestaSchema = registry.register(
  'ImportacionBloques',
  z.object({ importados: z.number().int(), bloques: z.array(BloqueRespuestaSchema) }),
);

// Reglas sobre un bloque ya combinado (PATCH).
export function validarBloque(datos: DatosBloque): void {
  const resultado = BloqueSchema.safeParse(datos);
  if (!resultado.success) throw errores.validacion(erroresDeZod(resultado.error));
}
