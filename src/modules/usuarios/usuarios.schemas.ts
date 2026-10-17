import { z } from 'zod';
import { registry } from '../../common/openapi/registry.js';
import { contrasenaSchema } from '../../common/security/passwords.js';

export const correoSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(120, 'El correo no puede superar 120 caracteres')
  .pipe(z.email('Correo inválido'))
  .openapi({ example: 'ana@correo.com' });

export const nombreSchema = z
  .string()
  .trim()
  .min(1, 'El nombre es obligatorio')
  .max(80, 'El nombre no puede superar 80 caracteres')
  .openapi({ example: 'Ana Gómez' });

export const UsuarioSchema = registry.register(
  'Usuario',
  z.object({
    idUsuario: z.number().int(),
    nombre: z.string(),
    correo: z.string(),
    fechaRegistro: z.iso.datetime(),
    aceptaDatos: z.boolean(),
    rol: z.enum(['user', 'admin']),
  }),
);

export type UsuarioDto = z.infer<typeof UsuarioSchema>;

export const ActualizarUsuarioSchema = z
  .object({
    nombre: nombreSchema.optional(),
    correo: correoSchema.optional(),
    contrasena: contrasenaSchema.optional(),
    contrasenaActual: z.string().min(1).optional(),
  })
  .strict()
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Envía al menos un campo para actualizar',
  })
  .refine((datos) => datos.contrasena === undefined || datos.contrasenaActual !== undefined, {
    message: 'Para cambiar la contraseña envía contrasenaActual',
    path: ['contrasenaActual'],
  });

export type ActualizarUsuario = z.infer<typeof ActualizarUsuarioSchema>;
