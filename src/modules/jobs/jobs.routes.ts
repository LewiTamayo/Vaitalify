import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { cronAuth } from '../../common/middleware/cron-auth.js';
import { cuerpoJson, registry, respuestasError } from '../../common/openapi/registry.js';
import * as servicio from './jobs.service.js';

registry.registerComponent('securitySchemes', 'cronSecret', {
  type: 'http',
  scheme: 'bearer',
  description: 'CRON_SECRET (lo envía Vercel Cron)',
});

const comun = { tags: ['Jobs (Vercel Cron)'], security: [{ cronSecret: [] }] };

registry.registerPath({
  ...comun,
  method: 'get',
  path: '/jobs/generar-recordatorios',
  summary: 'Genera los recordatorios del día de todos los usuarios con perfil (diario)',
  responses: {
    200: {
      description: 'Resumen',
      ...cuerpoJson(
        z.object({
          fecha: z.string(),
          usuarios: z.number().int(),
          generados: z.number().int(),
          fallidos: z.number().int(),
        }),
      ),
    },
    ...respuestasError(401),
  },
});
registry.registerPath({
  ...comun,
  method: 'get',
  path: '/jobs/limpieza',
  summary: 'Borra claves de idempotencia de más de 24 h y refresh tokens vencidos',
  responses: {
    200: {
      description: 'Filas borradas',
      ...cuerpoJson(z.object({ idempotencia: z.number().int(), refreshTokens: z.number().int() })),
    },
    ...respuestasError(401),
  },
});

// Controllers de una línea: se definen junto a las rutas.
async function generarRecordatorios(_req: Request, res: Response): Promise<void> {
  res.json(await servicio.generarRecordatoriosDeHoy());
}

async function limpieza(_req: Request, res: Response): Promise<void> {
  res.json(await servicio.limpiar());
}

export const jobsRouter = Router();

jobsRouter.use('/jobs', cronAuth);
jobsRouter.get('/jobs/generar-recordatorios', generarRecordatorios);
jobsRouter.get('/jobs/limpieza', limpieza);
