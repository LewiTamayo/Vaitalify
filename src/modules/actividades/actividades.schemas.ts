import { z } from 'zod';
import { registry } from '../../common/openapi/registry.js';
import { PaginacionSchema } from '../../common/utils/pagination.js';

export const CATEGORIAS = ['estiramiento', 'caminata', 'bajo_impacto'] as const;
const CategoriaSchema = z.enum(CATEGORIAS);

const DuracionSchema = z
  .number()
  .int('duracionMin debe ser un entero')
  .min(1, 'duracionMin debe estar entre 1 y 15')
  .max(15, 'duracionMin debe estar entre 1 y 15')
  .openapi({ example: 10 });

const ActividadBaseSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(80)
    .openapi({ example: 'Caminata corta' }),
  categoria: CategoriaSchema,
  duracionMin: DuracionSchema,
  instrucciones: z
    .string()
    .trim()
    .min(1, 'Las instrucciones son obligatorias')
    .max(2000)
    .openapi({ example: '1. Levántate.\n2. Camina 8 minutos.' }),
});

export const ActividadSchema = ActividadBaseSchema.strict();

export const ActividadParcialSchema = ActividadBaseSchema.partial()
  .strict()
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Envía al menos un campo para actualizar',
  });

export const FiltrosActividadesSchema = PaginacionSchema.extend({
  categoria: CategoriaSchema.optional(),
  maxDuracionMin: z.coerce.number().pipe(DuracionSchema).optional(),
});

export const ActividadRespuestaSchema = registry.register(
  'Actividad',
  ActividadBaseSchema.extend({ idActividad: z.number().int() }),
);

export type DatosActividad = z.infer<typeof ActividadSchema>;
export type DatosActividadParcial = z.infer<typeof ActividadParcialSchema>;
export type FiltrosActividades = z.infer<typeof FiltrosActividadesSchema>;
export type ActividadDto = z.infer<typeof ActividadRespuestaSchema>;
