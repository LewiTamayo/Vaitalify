import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../common/middleware/auth.js';
import { validate } from '../../common/middleware/validate.js';
import { cuerpoJson, registry, respuestasError } from '../../common/openapi/registry.js';
import * as controller from './usuarios.controller.js';
import { ActualizarUsuarioSchema, UsuarioSchema } from './usuarios.schemas.js';

const comun = { tags: ['Usuarios'], security: [{ bearerAuth: [] }] };

registry.registerPath({
  ...comun,
  method: 'get',
  path: '/usuarios/me',
  summary: 'Datos de la cuenta propia',
  responses: {
    200: { description: 'Cuenta', ...cuerpoJson(UsuarioSchema) },
    ...respuestasError(401),
  },
});

registry.registerPath({
  ...comun,
  method: 'patch',
  path: '/usuarios/me',
  summary: 'Actualiza nombre, correo o contraseña (esta última exige contrasenaActual)',
  request: { body: cuerpoJson(ActualizarUsuarioSchema) },
  responses: {
    200: { description: 'Cuenta actualizada', ...cuerpoJson(UsuarioSchema) },
    ...respuestasError(400, 401, 409, 422),
  },
});

registry.registerPath({
  ...comun,
  method: 'delete',
  path: '/usuarios/me',
  summary: 'Elimina la cuenta y todos sus datos (derecho de supresión, Ley 1581/2012)',
  responses: { 204: { description: 'Cuenta eliminada' }, ...respuestasError(401) },
});

registry.registerPath({
  ...comun,
  method: 'get',
  path: '/usuarios/me/exportar',
  summary: 'Descarga todos los datos propios en JSON (derecho de acceso, Ley 1581/2012)',
  responses: {
    200: { description: 'Adjunto vitalify-datos.json', ...cuerpoJson(z.object({}).loose()) },
    ...respuestasError(401),
  },
});

export const usuariosRouter = Router();

usuariosRouter.use('/usuarios/me', requireAuth);
usuariosRouter.get('/usuarios/me', controller.obtener);
usuariosRouter.patch(
  '/usuarios/me',
  validate({ body: ActualizarUsuarioSchema }),
  controller.actualizar,
);
usuariosRouter.delete('/usuarios/me', controller.eliminar);
usuariosRouter.get('/usuarios/me/exportar', controller.exportar);
