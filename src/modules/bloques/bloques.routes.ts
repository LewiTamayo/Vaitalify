import express, { Router } from 'express';
import { IdParamSchema } from '../../common/http/params.js';
import { requireAuth } from '../../common/middleware/auth.js';
import { validate } from '../../common/middleware/validate.js';
import {
  cuerpoJson,
  esquemaPaginado,
  registry,
  respuestasError,
} from '../../common/openapi/registry.js';
import * as controller from './bloques.controller.js';
import {
  BloqueParcialSchema,
  BloqueRespuestaSchema,
  BloqueSchema,
  FiltrosBloquesSchema,
  ImportacionRespuestaSchema,
  ImportarBloquesSchema,
} from './bloques.schemas.js';

// La importación tiene su propio parser JSON de hasta 1 MB (el general es de 100 kB, ver app.ts).
export const RUTA_IMPORTAR = '/bloques/importar';

const comun = { tags: ['Bloques de horario'], security: [{ bearerAuth: [] }] };
const conId = { ...comun, path: '/bloques/{id}', request: { params: IdParamSchema } };
const respuestaBloque = (description: string) => ({
  description,
  ...cuerpoJson(BloqueRespuestaSchema),
});

registry.registerPath({
  ...comun,
  method: 'post',
  path: '/bloques',
  summary: 'Crea un bloque de horario (pueden solaparse)',
  request: { body: cuerpoJson(BloqueSchema) },
  responses: { 201: respuestaBloque('Bloque creado'), ...respuestasError(400, 401) },
});
registry.registerPath({
  ...comun,
  method: 'post',
  path: RUTA_IMPORTAR,
  summary: 'Importa hasta 200 bloques de una vez (todos o ninguno; origen importado)',
  request: { body: cuerpoJson(ImportarBloquesSchema) },
  responses: {
    201: { description: 'Bloques importados', ...cuerpoJson(ImportacionRespuestaSchema) },
    ...respuestasError(400, 401),
  },
});
registry.registerPath({
  ...comun,
  method: 'get',
  path: '/bloques',
  summary: 'Lista los bloques propios (filtros tipo y diaSemana, paginado)',
  request: { query: FiltrosBloquesSchema },
  responses: {
    200: {
      description: 'Página de bloques',
      ...cuerpoJson(esquemaPaginado(BloqueRespuestaSchema)),
    },
    ...respuestasError(400, 401),
  },
});
registry.registerPath({
  ...conId,
  method: 'get',
  summary: 'Detalle de un bloque',
  responses: { 200: respuestaBloque('Bloque'), ...respuestasError(400, 401, 404) },
});
registry.registerPath({
  ...conId,
  method: 'put',
  summary: 'Reemplaza un bloque',
  request: { ...conId.request, body: cuerpoJson(BloqueSchema) },
  responses: { 200: respuestaBloque('Bloque'), ...respuestasError(400, 401, 404) },
});
registry.registerPath({
  ...conId,
  method: 'patch',
  summary: 'Actualiza parcialmente un bloque',
  request: { ...conId.request, body: cuerpoJson(BloqueParcialSchema) },
  responses: { 200: respuestaBloque('Bloque'), ...respuestasError(400, 401, 404) },
});
registry.registerPath({
  ...conId,
  method: 'delete',
  summary: 'Elimina un bloque',
  responses: { 204: { description: 'Bloque eliminado' }, ...respuestasError(400, 401, 404) },
});

const id = validate({ params: IdParamSchema });

export const bloquesRouter = Router();

bloquesRouter.use('/bloques', requireAuth);
bloquesRouter.post('/bloques', validate({ body: BloqueSchema }), controller.crear);
bloquesRouter.post(
  RUTA_IMPORTAR,
  express.json({ limit: '1mb' }),
  validate({ body: ImportarBloquesSchema }),
  controller.importar,
);
bloquesRouter.get('/bloques', validate({ query: FiltrosBloquesSchema }), controller.listar);
bloquesRouter.get('/bloques/:id', id, controller.obtener);
bloquesRouter.put(
  '/bloques/:id',
  validate({ params: IdParamSchema, body: BloqueSchema }),
  controller.reemplazar,
);
bloquesRouter.patch(
  '/bloques/:id',
  validate({ params: IdParamSchema, body: BloqueParcialSchema }),
  controller.actualizar,
);
bloquesRouter.delete('/bloques/:id', id, controller.eliminar);
