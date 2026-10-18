import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../../common/middleware/auth.js';
import { validate } from '../../common/middleware/validate.js';
import { cuerpoJson, registry, respuestasError } from '../../common/openapi/registry.js';
import { ProgresoSchema, ResumenSemanalSchema, SemanaQuerySchema } from './progreso.schemas.js';
import * as servicio from './progreso.service.js';

const comun = { tags: ['Progreso'], security: [{ bearerAuth: [] }] };

registry.registerPath({
  ...comun,
  method: 'get',
  path: '/progreso',
  summary: 'Puntos, racha vigente, racha máxima y comodines (solo lectura)',
  responses: {
    200: { description: 'Progreso', ...cuerpoJson(ProgresoSchema) },
    ...respuestasError(401),
  },
});
registry.registerPath({
  ...comun,
  method: 'get',
  path: '/progreso/semanal',
  summary: 'Resumen de la semana ISO: sueño, actividad, racha e insignias (§7.5)',
  request: { query: SemanaQuerySchema },
  responses: {
    200: { description: 'Resumen semanal', ...cuerpoJson(ResumenSemanalSchema) },
    ...respuestasError(400, 401),
  },
});

// Controllers de una línea: se definen junto a las rutas.
async function obtener(req: Request, res: Response): Promise<void> {
  res.json(await servicio.obtener(req.usuario!.idUsuario));
}

async function semanal(req: Request, res: Response): Promise<void> {
  const { semana } = req.valid.query as { semana?: string };
  res.json(await servicio.semanal(req.usuario!.idUsuario, semana));
}

export const progresoRouter = Router();

progresoRouter.use('/progreso', requireAuth);
progresoRouter.get('/progreso', obtener);
progresoRouter.get('/progreso/semanal', validate({ query: SemanaQuerySchema }), semanal);
