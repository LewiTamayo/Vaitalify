import { Router } from 'express';
import { z } from 'zod';
import { IdParamSchema } from '../../common/http/params.js';
import { requireAuth } from '../../common/middleware/auth.js';
import { validate } from '../../common/middleware/validate.js';
import {
  cuerpoJson,
  esquemaPaginado,
  registry,
  respuestasError,
} from '../../common/openapi/registry.js';
import * as controller from './recordatorios.controller.js';
import {
  ActualizarRecordatorioSchema,
  FiltrosRecordatoriosSchema,
  GenerarSchema,
  PendientesSchema,
  RecordatorioSchema,
  ResultadoGeneracionSchema,
} from './recordatorios.schemas.js';

const comun = { tags: ['Recordatorios'], security: [{ bearerAuth: [] }] };
const conId = { ...comun, path: '/recordatorios/{id}', request: { params: IdParamSchema } };
const respuesta = (description: string) => ({ description, ...cuerpoJson(RecordatorioSchema) });

registry.registerPath({
  ...comun,
  method: 'post',
  path: '/recordatorios/generar',
  summary: 'Genera (idempotente) los recordatorios de sueño y de pausas de un día',
  request: { body: cuerpoJson(GenerarSchema) },
  responses: {
    200: { description: 'Resultado', ...cuerpoJson(ResultadoGeneracionSchema) },
    ...respuestasError(400, 401),
  },
});
registry.registerPath({
  ...comun,
  method: 'get',
  path: '/recordatorios',
  summary: 'Lista los recordatorios (filtros tipo, enviado, desde, hasta)',
  request: { query: FiltrosRecordatoriosSchema },
  responses: {
    200: { description: 'Página', ...cuerpoJson(esquemaPaginado(RecordatorioSchema)) },
    ...respuestasError(400, 401),
  },
});
registry.registerPath({
  ...comun,
  method: 'get',
  path: '/recordatorios/pendientes',
  summary: 'No enviados de las próximas horas: la app los programa como notificaciones locales',
  request: { query: PendientesSchema },
  responses: {
    200: { description: 'Pendientes', ...cuerpoJson(z.array(RecordatorioSchema)) },
    ...respuestasError(400, 401),
  },
});
registry.registerPath({
  ...conId,
  method: 'get',
  summary: 'Detalle de un recordatorio',
  responses: { 200: respuesta('Recordatorio'), ...respuestasError(400, 401, 404) },
});
registry.registerPath({
  ...conId,
  method: 'patch',
  summary: 'Edita mensaje/instante (si no se envió) o marca { enviado: true }',
  request: { ...conId.request, body: cuerpoJson(ActualizarRecordatorioSchema) },
  responses: { 200: respuesta('Recordatorio'), ...respuestasError(400, 401, 404, 409, 422) },
});
registry.registerPath({
  ...conId,
  method: 'delete',
  summary: 'Elimina un recordatorio',
  responses: { 204: { description: 'Eliminado' }, ...respuestasError(400, 401, 404) },
});

const id = validate({ params: IdParamSchema });

export const recordatoriosRouter = Router();

recordatoriosRouter.use('/recordatorios', requireAuth);
recordatoriosRouter.post(
  '/recordatorios/generar',
  validate({ body: GenerarSchema }),
  controller.generar,
);
recordatoriosRouter.get(
  '/recordatorios',
  validate({ query: FiltrosRecordatoriosSchema }),
  controller.listar,
);
recordatoriosRouter.get(
  '/recordatorios/pendientes',
  validate({ query: PendientesSchema }),
  controller.pendientes,
);
recordatoriosRouter.get('/recordatorios/:id', id, controller.obtener);
recordatoriosRouter.patch(
  '/recordatorios/:id',
  validate({ params: IdParamSchema, body: ActualizarRecordatorioSchema }),
  controller.actualizar,
);
recordatoriosRouter.delete('/recordatorios/:id', id, controller.eliminar);
