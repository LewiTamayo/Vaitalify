import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../common/middleware/auth.js';
import { validate } from '../../common/middleware/validate.js';
import { cuerpoJson, registry, respuestasError } from '../../common/openapi/registry.js';
import * as controller from './config-notificaciones.controller.js';
import {
  ConfigRespuestaSchema,
  ConfigSchema,
  CrearConfigSchema,
  TipoParamSchema,
} from './config-notificaciones.schemas.js';

const comun = { tags: ['Notificaciones'], security: [{ bearerAuth: [] }] };
const conTipo = {
  ...comun,
  path: '/config-notificaciones/{tipo}',
  request: { params: TipoParamSchema },
};
const respuesta = (description: string) => ({
  description,
  ...cuerpoJson(ConfigRespuestaSchema),
});

registry.registerPath({
  ...comun,
  method: 'get',
  path: '/config-notificaciones',
  summary: 'Configuración de los 3 tipos (sueno, pausa, logros)',
  responses: {
    200: { description: 'Configuraciones', ...cuerpoJson(z.array(ConfigRespuestaSchema)) },
    ...respuestasError(401),
  },
});
registry.registerPath({
  ...comun,
  method: 'post',
  path: '/config-notificaciones',
  summary: 'Crea la configuración de un tipo (409 si existe)',
  request: { body: cuerpoJson(CrearConfigSchema) },
  responses: { 201: respuesta('Creada'), ...respuestasError(400, 401, 409) },
});
registry.registerPath({
  ...conTipo,
  method: 'get',
  summary: 'Configuración de un tipo',
  responses: { 200: respuesta('Configuración'), ...respuestasError(400, 401, 404) },
});
registry.registerPath({
  ...conTipo,
  method: 'put',
  summary: 'Activa/desactiva y define el horario de silencio (puede cruzar medianoche)',
  request: { ...conTipo.request, body: cuerpoJson(ConfigSchema) },
  responses: { 200: respuesta('Configuración'), ...respuestasError(400, 401, 404) },
});
registry.registerPath({
  ...conTipo,
  method: 'delete',
  summary: 'Restablece los valores por defecto (activa, sin silencio)',
  responses: { 204: { description: 'Restablecida' }, ...respuestasError(400, 401) },
});

const ruta = '/config-notificaciones';
const rutaTipo = `${ruta}/:tipo`;
const conTipoValido = validate({ params: TipoParamSchema });

export const configNotificacionesRouter = Router();

configNotificacionesRouter.use(ruta, requireAuth);
configNotificacionesRouter.get(ruta, controller.listar);
configNotificacionesRouter.post(ruta, validate({ body: CrearConfigSchema }), controller.crear);
configNotificacionesRouter.get(rutaTipo, conTipoValido, controller.obtener);
configNotificacionesRouter.put(
  rutaTipo,
  validate({ params: TipoParamSchema, body: ConfigSchema }),
  controller.reemplazar,
);
configNotificacionesRouter.delete(rutaTipo, conTipoValido, controller.restablecer);
