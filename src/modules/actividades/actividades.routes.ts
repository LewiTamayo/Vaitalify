import { Router } from 'express';
import { IdParamSchema } from '../../common/http/params.js';
import { requireAuth } from '../../common/middleware/auth.js';
import { requireRole } from '../../common/middleware/require-role.js';
import { validate } from '../../common/middleware/validate.js';
import {
  cuerpoJson,
  esquemaPaginado,
  registry,
  respuestasError,
} from '../../common/openapi/registry.js';
import * as controller from './actividades.controller.js';
import {
  ActividadParcialSchema,
  ActividadRespuestaSchema,
  ActividadSchema,
  FiltrosActividadesSchema,
} from './actividades.schemas.js';

const comun = { tags: ['Actividades'], security: [{ bearerAuth: [] }] };
const conId = { ...comun, path: '/actividades/{id}', request: { params: IdParamSchema } };
const respuesta = (description: string) => ({
  description,
  ...cuerpoJson(ActividadRespuestaSchema),
});

registry.registerPath({
  ...comun,
  method: 'get',
  path: '/actividades',
  summary: 'Catálogo de actividades (filtros categoria y maxDuracionMin)',
  request: { query: FiltrosActividadesSchema },
  responses: {
    200: {
      description: 'Página de actividades',
      ...cuerpoJson(esquemaPaginado(ActividadRespuestaSchema)),
    },
    ...respuestasError(400, 401),
  },
});
registry.registerPath({
  ...conId,
  method: 'get',
  summary: 'Detalle de una actividad',
  responses: { 200: respuesta('Actividad'), ...respuestasError(400, 401, 404) },
});
registry.registerPath({
  ...comun,
  method: 'post',
  path: '/actividades',
  summary: 'Crea una actividad (solo admin)',
  request: { body: cuerpoJson(ActividadSchema) },
  responses: { 201: respuesta('Actividad creada'), ...respuestasError(400, 401, 403) },
});
registry.registerPath({
  ...conId,
  method: 'put',
  summary: 'Reemplaza una actividad (solo admin)',
  request: { ...conId.request, body: cuerpoJson(ActividadSchema) },
  responses: { 200: respuesta('Actividad'), ...respuestasError(400, 401, 403, 404) },
});
registry.registerPath({
  ...conId,
  method: 'patch',
  summary: 'Actualiza parcialmente una actividad (solo admin)',
  request: { ...conId.request, body: cuerpoJson(ActividadParcialSchema) },
  responses: { 200: respuesta('Actividad'), ...respuestasError(400, 401, 403, 404) },
});
registry.registerPath({
  ...conId,
  method: 'delete',
  summary: 'Elimina una actividad sin micro-pausas asociadas (solo admin)',
  responses: { 204: { description: 'Eliminada' }, ...respuestasError(400, 401, 403, 404, 409) },
});

const soloAdmin = requireRole('admin');

export const actividadesRouter = Router();

actividadesRouter.use('/actividades', requireAuth);
actividadesRouter.get(
  '/actividades',
  validate({ query: FiltrosActividadesSchema }),
  controller.listar,
);
actividadesRouter.get('/actividades/:id', validate({ params: IdParamSchema }), controller.obtener);
actividadesRouter.post(
  '/actividades',
  soloAdmin,
  validate({ body: ActividadSchema }),
  controller.crear,
);
actividadesRouter.put(
  '/actividades/:id',
  soloAdmin,
  validate({ params: IdParamSchema, body: ActividadSchema }),
  controller.actualizar,
);
actividadesRouter.patch(
  '/actividades/:id',
  soloAdmin,
  validate({ params: IdParamSchema, body: ActividadParcialSchema }),
  controller.actualizar,
);
actividadesRouter.delete(
  '/actividades/:id',
  soloAdmin,
  validate({ params: IdParamSchema }),
  controller.eliminar,
);
