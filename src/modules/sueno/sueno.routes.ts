import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../../common/middleware/auth.js';
import { validate } from '../../common/middleware/validate.js';
import { cuerpoJson, registry, respuestasError } from '../../common/openapi/registry.js';
import { RecomendacionQuerySchema, RecomendacionSuenoSchema } from './sueno.schemas.js';
import * as servicio from './sueno.service.js';

registry.registerPath({
  tags: ['Sueño'],
  security: [{ bearerAuth: [] }],
  method: 'get',
  path: '/sueno/recomendacion',
  summary: 'Hora sugerida para acostarse según la primera actividad del día siguiente (§7.3)',
  request: { query: RecomendacionQuerySchema },
  responses: {
    200: { description: 'Recomendación', ...cuerpoJson(RecomendacionSuenoSchema) },
    ...respuestasError(400, 401, 422),
  },
});

// Controller de una sola función: se define junto a la ruta.
async function recomendacion(req: Request, res: Response): Promise<void> {
  const { fecha } = req.valid.query as { fecha?: string };
  res.json(await servicio.recomendacion(req.usuario!.idUsuario, fecha));
}

export const suenoRouter = Router();

suenoRouter.get(
  '/sueno/recomendacion',
  requireAuth,
  validate({ query: RecomendacionQuerySchema }),
  recomendacion,
);
