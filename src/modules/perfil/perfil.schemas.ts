import { z } from 'zod';
import { errores } from '../../common/errors/app-error.js';
import { erroresDeZod } from '../../common/errors/zod-errors.js';
import { registry } from '../../common/openapi/registry.js';
import { HoraSchema } from '../../common/utils/time.js';

const PerfilBaseSchema = z.object({
  horaDormir: HoraSchema.openapi({ example: '22:45' }),
  horaDespertar: HoraSchema.openapi({ example: '06:15' }),
  metaHorasSueno: z
    .number()
    .min(4, 'metaHorasSueno debe estar entre 4 y 12')
    .max(12, 'metaHorasSueno debe estar entre 4 y 12')
    .multipleOf(0.5, 'metaHorasSueno va en pasos de 0.5')
    .openapi({ example: 7.5, description: 'Horas de sueño por noche (OMS: 7–9)' }),
  metaMinActividad: z
    .number()
    .int('metaMinActividad debe ser un entero')
    .min(0, 'metaMinActividad debe estar entre 0 y 1500')
    .max(1500, 'metaMinActividad debe estar entre 0 y 1500')
    .openapi({ example: 150, description: 'Minutos de actividad por semana (OMS: 150–300)' }),
});

export const PerfilSchema = PerfilBaseSchema.strict().refine(
  (p) => p.horaDormir !== p.horaDespertar,
  { message: 'horaDespertar debe ser distinta de horaDormir', path: ['horaDespertar'] },
);

export const PerfilParcialSchema = PerfilBaseSchema.partial()
  .strict()
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Envía al menos un campo para actualizar',
  });

export const PerfilRespuestaSchema = registry.register(
  'Perfil',
  PerfilBaseSchema.extend({ idPerfil: z.number().int() }),
);

export type DatosPerfil = z.infer<typeof PerfilSchema>;
export type DatosPerfilParcial = z.infer<typeof PerfilParcialSchema>;
export type PerfilDto = z.infer<typeof PerfilRespuestaSchema>;

// Reglas sobre un perfil ya combinado (PATCH).
export function validarPerfilCompleto(datos: DatosPerfil): void {
  const resultado = PerfilSchema.safeParse(datos);
  if (!resultado.success) throw errores.validacion(erroresDeZod(resultado.error));
}
