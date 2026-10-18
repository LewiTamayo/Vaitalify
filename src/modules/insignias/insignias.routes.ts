import { Router } from 'express';
import { z } from 'zod';
import { IdParamSchema } from '../../common/http/params.js';
import { requireAuth } from '../../common/middleware/auth.js';
import { requireRole } from '../../common/middleware/require-role.js';
import { validate } from '../../common/middleware/validate.js';
import { cuerpoJson, registry, respuestasError } from '../../common/openapi/registry.js';
import * as controller from './insignias.controller.js';
import {
  InsigniaRespuestaSchema,
  InsigniaSchema,
  InsigniaUsuarioSchema,
} from './insignias.schemas.js';

const comun = { tags: ['Insignias'], security: [{ bearerAuth: [] }] };
const conId = { ...comun, path: '/insignias/{id}', request: { params: IdParamSchema } };
const lista = (description: string) => ({
  description,
  ...cuerpoJson(z.array(InsigniaUsuarioSchema)),
});

registry.registerPath({
  ...comun,
  method: 'get',
  path: '/insignias',
  summary: 'Catálogo de insignias con "obtenida" y "fechaObtencion" del usuario',
  responses: { 200: lista('Catálogo'), ...respuestasError(401) },
});
registry.registerPath({
  ...comun,
  method: 'get',
  path: '/usuarios/me/insignias',
  summary: 'Insignias obtenidas por el usuario',
  responses: { 200: lista('Insignias obtenidas'), ...respuestasError(401) },
});
registry.registerPath({
  ...comun,
  method: 'post',
  path: '/insignias',
  summary: 'Crea una insignia (solo admin)',
  request: { body: cuerpoJson(InsigniaSchema) },
  responses: {
    201: { description: 'Creada', ...cuerpoJson(InsigniaRespuestaSchema) },
    ...respuestasError(400, 401, 403, 409),
  },
});
registry.registerPath({
  ...conId,
  method: 'put',
  summary: 'Reemplaza una insignia (solo admin)',
  request: { ...conId.request, body: cuerpoJson(InsigniaSchema) },
  responses: {
    200: { description: 'Insignia', ...cuerpoJson(InsigniaRespuestaSchema) },
    ...respuestasError(400, 401, 403, 404, 409),
  },
});
registry.registerPath({
  ...conId,
  method: 'delete',
  summary: 'Elimina una insignia y sus asignaciones (solo admin)',
  responses: { 204: { description: 'Eliminada' }, ...respuestasError(400, 401, 403, 404) },
});

const soloAdmin = requireRole('admin');

export const insigniasRouter = Router();

insigniasRouter.get('/usuarios/me/insignias', requireAuth, controller.propias);
insigniasRouter.use('/insignias', requireAuth);
insigniasRouter.get('/insignias', controller.catalogo);
insigniasRouter.post('/insignias', soloAdmin, validate({ body: InsigniaSchema }), controller.crear);
insigniasRouter.put(
  '/insignias/:id',
  soloAdmin,
  validate({ params: IdParamSchema, body: InsigniaSchema }),
  controller.reemplazar,
);
insigniasRouter.delete(
  '/insignias/:id',
  soloAdmin,
  validate({ params: IdParamSchema }),
  controller.eliminar,
);
