import { Router } from 'express';
import { z } from 'zod';
import { IdParamSchema } from '../../common/http/params.js';
import { requireAuth } from '../../common/middleware/auth.js';
import { idempotencia } from '../../common/middleware/idempotency.js';
import { validate } from '../../common/middleware/validate.js';
import {
  cabeceraIdempotencia,
  cuerpoJson,
  esquemaPaginado,
  registry,
  respuestasError,
} from '../../common/openapi/registry.js';
import * as controller from './micro-pausas.controller.js';
import {
  CambiarActividadSchema,
  CambiarEstadoSchema,
  MicroPausaConProgresoSchema,
  FiltrosPausasSchema,
  IdVentanaParamSchema,
  MicroPausaSchema,
  RecomendarSchema,
} from './micro-pausas.schemas.js';

const comun = { tags: ['Micro-pausas'], security: [{ bearerAuth: [] }] };
const conId = { ...comun, path: '/micro-pausas/{id}', request: { params: IdParamSchema } };
const respuesta = (description: string) => ({ description, ...cuerpoJson(MicroPausaSchema) });

registry.registerPath({
  ...comun,
  method: 'post',
  path: '/micro-ventanas/{idVentana}/micro-pausa',
  summary: 'Recomienda y asigna una micro-pausa a la micro-ventana (§7.2)',
  request: { params: IdVentanaParamSchema, body: cuerpoJson(RecomendarSchema) },
  responses: { 201: respuesta('Micro-pausa creada'), ...respuestasError(400, 401, 404, 409, 422) },
});
registry.registerPath({
  ...comun,
  method: 'get',
  path: '/micro-pausas',
  summary: 'Lista las micro-pausas (filtros estado, desde, hasta)',
  request: { query: FiltrosPausasSchema },
  responses: {
    200: { description: 'Página', ...cuerpoJson(esquemaPaginado(MicroPausaSchema)) },
    ...respuestasError(400, 401),
  },
});
registry.registerPath({
  ...comun,
  method: 'get',
  path: '/micro-pausas/hoy',
  summary: 'Micro-pausas de hoy ordenadas por hora (pantalla "Hoy")',
  responses: {
    200: { description: 'Micro-pausas de hoy', ...cuerpoJson(z.array(MicroPausaSchema)) },
    ...respuestasError(401),
  },
});
registry.registerPath({
  ...conId,
  method: 'get',
  summary: 'Detalle de una micro-pausa',
  responses: { 200: respuesta('Micro-pausa'), ...respuestasError(400, 401, 404) },
});
registry.registerPath({
  ...conId,
  method: 'patch',
  summary:
    'Registra el cumplimiento (pendiente, hecha u omitida); devuelve puntos, racha e insignias nuevas',
  request: {
    ...conId.request,
    headers: cabeceraIdempotencia,
    body: cuerpoJson(CambiarEstadoSchema),
  },
  responses: {
    200: { description: 'Micro-pausa y progreso', ...cuerpoJson(MicroPausaConProgresoSchema) },
    ...respuestasError(400, 401, 404, 422),
  },
});
registry.registerPath({
  ...conId,
  method: 'put',
  summary: 'Cambia la actividad (solo si está pendiente y cabe en la ventana)',
  request: { ...conId.request, body: cuerpoJson(CambiarActividadSchema) },
  responses: { 200: respuesta('Micro-pausa'), ...respuestasError(400, 401, 404, 422) },
});
registry.registerPath({
  ...conId,
  method: 'delete',
  summary: 'Elimina una micro-pausa (no revierte puntos)',
  responses: { 204: { description: 'Eliminada' }, ...respuestasError(400, 401, 404) },
});

const id = validate({ params: IdParamSchema });

export const microPausasRouter = Router();

microPausasRouter.post(
  '/micro-ventanas/:idVentana/micro-pausa',
  requireAuth,
  validate({ params: IdVentanaParamSchema, body: RecomendarSchema }),
  controller.recomendar,
);
microPausasRouter.use('/micro-pausas', requireAuth);
microPausasRouter.get('/micro-pausas', validate({ query: FiltrosPausasSchema }), controller.listar);
microPausasRouter.get('/micro-pausas/hoy', controller.hoy);
microPausasRouter.get('/micro-pausas/:id', id, controller.obtener);
microPausasRouter.patch(
  '/micro-pausas/:id',
  idempotencia(),
  validate({ params: IdParamSchema, body: CambiarEstadoSchema }),
  controller.cambiarEstado,
);
microPausasRouter.put(
  '/micro-pausas/:id',
  validate({ params: IdParamSchema, body: CambiarActividadSchema }),
  controller.cambiarActividad,
);
microPausasRouter.delete('/micro-pausas/:id', id, controller.eliminar);
