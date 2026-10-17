import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../common/middleware/auth.js';
import { rateLimit } from '../../common/middleware/rate-limit.js';
import { validate } from '../../common/middleware/validate.js';
import { cuerpoJson, registry, respuestasError } from '../../common/openapi/registry.js';
import { REGLAS, type FabricaLimitador } from '../../common/ratelimit/limitador.js';
import * as controller from './usuarios.controller.js';
import { ActualizarUsuarioSchema, UsuarioSchema } from './usuarios.schemas.js';

const comun = { tags: ['Usuarios'], security: [{ bearerAuth: [] }] };

registry.registerPath({
  ...comun,
  method: 'get',
  path: '/usuarios/me',
  summary: 'Datos de la cuenta propia',
  responses: {
    200: { description: 'Cuenta', ...cuerpoJson(UsuarioSchema) },
    ...respuestasError(401),
  },
});

registry.registerPath({
  ...comun,
  method: 'patch',
  path: '/usuarios/me',
  summary: 'Actualiza nombre, correo o contraseña (esta última exige contrasenaActual)',
  request: { body: cuerpoJson(ActualizarUsuarioSchema) },
  responses: {
    200: { description: 'Cuenta actualizada', ...cuerpoJson(UsuarioSchema) },
    ...respuestasError(400, 401, 409, 422, 429),
  },
});

registry.registerPath({
  ...comun,
  method: 'delete',
  path: '/usuarios/me',
  summary: 'Elimina la cuenta y todos sus datos (derecho de supresión, Ley 1581/2012)',
  responses: { 204: { description: 'Cuenta eliminada' }, ...respuestasError(401) },
});

registry.registerPath({
  ...comun,
  method: 'get',
  path: '/usuarios/me/exportar',
  summary: 'Descarga todos los datos propios en JSON (derecho de acceso, Ley 1581/2012)',
  responses: {
    200: { description: 'Adjunto vitalify-datos.json', ...cuerpoJson(z.object({}).loose()) },
    ...respuestasError(401),
  },
});

// Cambiar la contraseña exige contrasenaActual: se limita como el login (por usuario) para que
// un access token robado no sirva para adivinarla por fuerza bruta.
function limiteCambioContrasena(fabrica: FabricaLimitador): RequestHandler {
  const limite = rateLimit(fabrica(REGLAS.login), (req) => `usuario:${req.usuario!.idUsuario}`);
  return (req, res, next) => {
    const cuerpo = req.body as { contrasena?: unknown } | undefined;
    if (cuerpo?.contrasena === undefined) {
      next();
      return;
    }
    void limite(req, res, next);
  };
}

export function crearUsuariosRouter(fabrica: FabricaLimitador): Router {
  const router = Router();
  router.use('/usuarios/me', requireAuth);
  router.get('/usuarios/me', controller.obtener);
  router.patch(
    '/usuarios/me',
    limiteCambioContrasena(fabrica),
    validate({ body: ActualizarUsuarioSchema }),
    controller.actualizar,
  );
  router.delete('/usuarios/me', controller.eliminar);
  router.get('/usuarios/me/exportar', controller.exportar);
  return router;
}
