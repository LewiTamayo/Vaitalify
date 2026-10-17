import { z } from 'zod';
import { registry } from '../../common/openapi/registry.js';
import { contrasenaSchema } from '../../common/security/passwords.js';
import { UsuarioSchema, correoSchema, nombreSchema } from '../usuarios/usuarios.schemas.js';

export const RegistroSchema = z
  .object({
    nombre: nombreSchema,
    correo: correoSchema,
    contrasena: contrasenaSchema.openapi({ example: 'secreta123' }),
    aceptaDatos: z
      .boolean()
      .openapi({
        description: 'Autorización de tratamiento de datos (Ley 1581/2012). Debe ser true.',
      }),
  })
  .strict();

export const LoginSchema = z
  .object({
    correo: correoSchema,
    contrasena: z.string().min(1, 'La contraseña es obligatoria'),
  })
  .strict();

export const RefreshSchema = z.object({ refreshToken: z.string().min(1) }).strict();

export const SesionSchema = registry.register(
  'Sesion',
  z.object({
    usuario: UsuarioSchema,
    accessToken: z.string(),
    refreshToken: z.string(),
  }),
);

export type Registro = z.infer<typeof RegistroSchema>;
export type Login = z.infer<typeof LoginSchema>;
export type RefreshBody = z.infer<typeof RefreshSchema>;
export type Sesion = z.infer<typeof SesionSchema>;
