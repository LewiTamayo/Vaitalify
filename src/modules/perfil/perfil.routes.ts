import { Router } from 'express';
import { requireAuth } from '../../common/middleware/auth.js';
import { validate } from '../../common/middleware/validate.js';
import { cuerpoJson, registry, respuestasError } from '../../common/openapi/registry.js';
import * as controller from './perfil.controller.js';
import { PerfilParcialSchema, PerfilRespuestaSchema, PerfilSchema } from './perfil.schemas.js';

const comun = { tags: ['Perfil'], security: [{ bearerAuth: [] }], path: '/perfil' };
const respuestaPerfil = (description: string) => ({
  description,
  ...cuerpoJson(PerfilRespuestaSchema),
});

registry.registerPath({
  ...comun,
  method: 'post',
  summary: 'Crea el perfil de hábitos (uno por usuario)',
  request: { body: cuerpoJson(PerfilSchema) },
  responses: { 201: respuestaPerfil('Perfil creado'), ...respuestasError(400, 401, 409) },
});
registry.registerPath({
  ...comun,
  method: 'get',
  summary: 'Obtiene el perfil (404 con indicaciones si aún no existe)',
  responses: { 200: respuestaPerfil('Perfil'), ...respuestasError(401, 404) },
});
registry.registerPath({
  ...comun,
  method: 'put',
  summary: 'Reemplaza el perfil',
  request: { body: cuerpoJson(PerfilSchema) },
  responses: { 200: respuestaPerfil('Perfil'), ...respuestasError(400, 401, 404) },
});
registry.registerPath({
  ...comun,
  method: 'patch',
  summary: 'Actualiza parcialmente el perfil',
  request: { body: cuerpoJson(PerfilParcialSchema) },
  responses: { 200: respuestaPerfil('Perfil'), ...respuestasError(400, 401, 404) },
});
registry.registerPath({
  ...comun,
  method: 'delete',
  summary: 'Elimina el perfil',
  responses: { 204: { description: 'Perfil eliminado' }, ...respuestasError(401, 404) },
});

export const perfilRouter = Router();

perfilRouter.use('/perfil', requireAuth);
perfilRouter.post('/perfil', validate({ body: PerfilSchema }), controller.crear);
perfilRouter.get('/perfil', controller.obtener);
perfilRouter.put('/perfil', validate({ body: PerfilSchema }), controller.reemplazar);
perfilRouter.patch('/perfil', validate({ body: PerfilParcialSchema }), controller.actualizar);
perfilRouter.delete('/perfil', controller.eliminar);
