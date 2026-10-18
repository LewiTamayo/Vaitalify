import { Router } from 'express';
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
import * as controller from './registros-sueno.controller.js';
import {
  FiltrosRegistrosSchema,
  RegistroSuenoRespuestaSchema,
  RegistroSuenoSchema,
} from './registros-sueno.schemas.js';

const comun = { tags: ['Sueño'], security: [{ bearerAuth: [] }] };
const conId = { ...comun, path: '/registros-sueno/{id}', request: { params: IdParamSchema } };
const respuesta = (description: string) => ({
  description,
  ...cuerpoJson(RegistroSuenoRespuestaSchema),
});

registry.registerPath({
  ...comun,
  method: 'post',
  path: '/registros-sueno',
  summary: 'Registra las horas dormidas de una fecha (admite Idempotency-Key)',
  request: { headers: cabeceraIdempotencia, body: cuerpoJson(RegistroSuenoSchema) },
  responses: { 201: respuesta('Registro creado'), ...respuestasError(400, 401, 409, 422) },
});
registry.registerPath({
  ...comun,
  method: 'get',
  path: '/registros-sueno',
  summary: 'Lista los registros de sueño (filtros desde, hasta)',
  request: { query: FiltrosRegistrosSchema },
  responses: {
    200: { description: 'Página', ...cuerpoJson(esquemaPaginado(RegistroSuenoRespuestaSchema)) },
    ...respuestasError(400, 401),
  },
});
registry.registerPath({
  ...conId,
  method: 'get',
  summary: 'Detalle de un registro de sueño',
  responses: { 200: respuesta('Registro'), ...respuestasError(400, 401, 404) },
});
registry.registerPath({
  ...conId,
  method: 'put',
  summary: 'Reemplaza un registro de sueño (admite Idempotency-Key)',
  request: {
    ...conId.request,
    headers: cabeceraIdempotencia,
    body: cuerpoJson(RegistroSuenoSchema),
  },
  responses: { 200: respuesta('Registro'), ...respuestasError(400, 401, 404, 409, 422) },
});
registry.registerPath({
  ...conId,
  method: 'delete',
  summary: 'Elimina un registro de sueño',
  responses: { 204: { description: 'Eliminado' }, ...respuestasError(400, 401, 404) },
});

export const registrosSuenoRouter = Router();

registrosSuenoRouter.use('/registros-sueno', requireAuth);
registrosSuenoRouter.post(
  '/registros-sueno',
  idempotencia(),
  validate({ body: RegistroSuenoSchema }),
  controller.crear,
);
registrosSuenoRouter.get(
  '/registros-sueno',
  validate({ query: FiltrosRegistrosSchema }),
  controller.listar,
);
registrosSuenoRouter.get(
  '/registros-sueno/:id',
  validate({ params: IdParamSchema }),
  controller.obtener,
);
registrosSuenoRouter.put(
  '/registros-sueno/:id',
  idempotencia(),
  validate({ params: IdParamSchema, body: RegistroSuenoSchema }),
  controller.reemplazar,
);
registrosSuenoRouter.delete(
  '/registros-sueno/:id',
  validate({ params: IdParamSchema }),
  controller.eliminar,
);
