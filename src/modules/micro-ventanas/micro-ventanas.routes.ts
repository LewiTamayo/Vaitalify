import { Router } from 'express';
import { IdParamSchema } from '../../common/http/params.js';
import { requireAuth } from '../../common/middleware/auth.js';
import { validate } from '../../common/middleware/validate.js';
import {
  cuerpoJson,
  esquemaPaginado,
  registry,
  respuestasError,
} from '../../common/openapi/registry.js';
import * as controller from './micro-ventanas.controller.js';
import {
  FiltrosVentanasSchema,
  MicroVentanaSchema,
  RangoRecalculoSchema,
  ResultadoRecalculoSchema,
} from './micro-ventanas.schemas.js';

const comun = { tags: ['Micro-ventanas'], security: [{ bearerAuth: [] }] };
const conId = { ...comun, path: '/micro-ventanas/{id}', request: { params: IdParamSchema } };

registry.registerPath({
  ...comun,
  method: 'post',
  path: '/micro-ventanas/recalcular',
  summary: 'Recalcula las micro-ventanas (por defecto hoy y los 6 días siguientes; máx. 31)',
  request: { body: cuerpoJson(RangoRecalculoSchema) },
  responses: {
    200: { description: 'Resultado', ...cuerpoJson(ResultadoRecalculoSchema) },
    ...respuestasError(400, 401, 422),
  },
});
registry.registerPath({
  ...comun,
  method: 'get',
  path: '/micro-ventanas',
  summary: 'Lista las micro-ventanas (filtros desde, hasta, conPausa)',
  request: { query: FiltrosVentanasSchema },
  responses: {
    200: { description: 'Página', ...cuerpoJson(esquemaPaginado(MicroVentanaSchema)) },
    ...respuestasError(400, 401),
  },
});
registry.registerPath({
  ...conId,
  method: 'get',
  summary: 'Detalle de una micro-ventana (incluye su micro-pausa)',
  responses: {
    200: { description: 'Micro-ventana', ...cuerpoJson(MicroVentanaSchema) },
    ...respuestasError(400, 401, 404),
  },
});
registry.registerPath({
  ...conId,
  method: 'delete',
  summary: 'Descarta una micro-ventana (y su micro-pausa)',
  responses: { 204: { description: 'Descartada' }, ...respuestasError(400, 401, 404) },
});

const id = validate({ params: IdParamSchema });

export const microVentanasRouter = Router();

microVentanasRouter.use('/micro-ventanas', requireAuth);
microVentanasRouter.post(
  '/micro-ventanas/recalcular',
  validate({ body: RangoRecalculoSchema }),
  controller.recalcular,
);
microVentanasRouter.get(
  '/micro-ventanas',
  validate({ query: FiltrosVentanasSchema }),
  controller.listar,
);
microVentanasRouter.get('/micro-ventanas/:id', id, controller.obtener);
microVentanasRouter.delete('/micro-ventanas/:id', id, controller.eliminar);
