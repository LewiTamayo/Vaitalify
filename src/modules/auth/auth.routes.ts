import { Router } from 'express';
import { ipCliente } from '../../common/http/ip.js';
import { requireAuth } from '../../common/middleware/auth.js';
import { rateLimit } from '../../common/middleware/rate-limit.js';
import { validate } from '../../common/middleware/validate.js';
import { cuerpoJson, registry, respuestasError } from '../../common/openapi/registry.js';
import { REGLAS, type FabricaLimitador } from '../../common/ratelimit/limitador.js';
import * as controller from './auth.controller.js';
import { LoginSchema, RefreshSchema, RegistroSchema, SesionSchema } from './auth.schemas.js';

const TAG = ['Auth'];

registry.registerPath({
  method: 'post',
  path: '/auth/registro',
  tags: TAG,
  summary: 'Crea una cuenta (y su progreso y configuración de notificaciones por defecto)',
  request: { body: cuerpoJson(RegistroSchema) },
  responses: {
    201: { description: 'Cuenta creada', ...cuerpoJson(SesionSchema) },
    ...respuestasError(400, 409, 422, 429),
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/login',
  tags: TAG,
  summary: 'Inicia sesión (5 intentos por minuto por IP)',
  request: { body: cuerpoJson(LoginSchema) },
  responses: {
    200: { description: 'Sesión iniciada', ...cuerpoJson(SesionSchema) },
    ...respuestasError(400, 401, 429),
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/refresh',
  tags: TAG,
  summary: 'Rota el refresh token y emite un nuevo par de tokens',
  request: { body: cuerpoJson(RefreshSchema) },
  responses: {
    200: { description: 'Nuevo par de tokens', ...cuerpoJson(SesionSchema) },
    ...respuestasError(400, 401, 429),
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/logout',
  tags: TAG,
  summary: 'Revoca el refresh token',
  security: [{ bearerAuth: [] }],
  request: { body: cuerpoJson(RefreshSchema) },
  responses: { 204: { description: 'Sesión cerrada' }, ...respuestasError(400, 401, 429) },
});

export function crearAuthRouter(fabrica: FabricaLimitador): Router {
  const router = Router();
  const limiteAuth = rateLimit(fabrica(REGLAS.auth), ipCliente);
  const limiteLogin = rateLimit(fabrica(REGLAS.login), ipCliente);

  router.post(
    '/auth/registro',
    limiteAuth,
    validate({ body: RegistroSchema }),
    controller.registro,
  );
  router.post('/auth/login', limiteLogin, validate({ body: LoginSchema }), controller.login);
  router.post('/auth/refresh', limiteAuth, validate({ body: RefreshSchema }), controller.refresh);
  router.post(
    '/auth/logout',
    limiteAuth,
    requireAuth,
    validate({ body: RefreshSchema }),
    controller.logout,
  );
  return router;
}
