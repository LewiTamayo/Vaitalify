import { Router } from 'express';
import { z } from 'zod';
import { registry } from '../../common/openapi/registry.js';
import { comprobarBaseDatos } from './health.service.js';

const HealthSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  db: z.enum(['up', 'down']),
});

registry.registerPath({
  method: 'get',
  path: '/health',
  tags: ['Utilidad'],
  summary: 'Liveness/readiness: estado de la API y de la base de datos',
  responses: {
    200: {
      description: 'API y BD disponibles',
      content: { 'application/json': { schema: HealthSchema } },
    },
    503: {
      description: 'BD no disponible',
      content: { 'application/json': { schema: HealthSchema } },
    },
  },
});

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  const dbArriba = await comprobarBaseDatos();
  res
    .status(dbArriba ? 200 : 503)
    .json(dbArriba ? { status: 'ok', db: 'up' } : { status: 'degraded', db: 'down' });
});
