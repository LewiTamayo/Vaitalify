import cors from 'cors';
import express, { Router, type Express } from 'express';
import { pinoHttp } from 'pino-http';
import { errorHandler, notFoundHandler } from './common/errors/error-handler.js';
import { logger } from './common/logger.js';
import { claveUsuarioOIp } from './common/middleware/auth.js';
import { helmet } from './common/middleware/helmet.js';
import { rateLimit } from './common/middleware/rate-limit.js';
import { docsRouter } from './common/openapi/docs.js';
import { REGLAS, fabricaPorDefecto, type FabricaLimitador } from './common/ratelimit/limitador.js';
import { env } from './config/env.js';
import { actividadesRouter } from './modules/actividades/actividades.routes.js';
import { crearAuthRouter } from './modules/auth/auth.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { RUTA_IMPORTAR, bloquesRouter } from './modules/bloques/bloques.routes.js';
import { perfilRouter } from './modules/perfil/perfil.routes.js';
import { crearUsuariosRouter } from './modules/usuarios/usuarios.routes.js';

export interface OpcionesApp {
  // Inyectable para que los tests no choquen con los límites reales.
  fabricaLimitador?: FabricaLimitador;
}

// ENTRY DE VERCEL: exporta la app sin llamar listen (ver src/local.ts para desarrollo).
export function createApp(opciones: OpcionesApp = {}): Express {
  const fabrica = opciones.fabricaLimitador ?? fabricaPorDefecto();
  const app = express();

  // Detrás del proxy de Vercel: req.ip y el protocolo vienen de x-forwarded-*.
  app.set('trust proxy', true);
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS }));
  // Límite general de 100 kB; la importación de bloques usa su propio parser de 1 MB.
  const jsonGeneral = express.json({ limit: '100kb' });
  app.use((req, res, next) => {
    if (req.path === `/api/v1${RUTA_IMPORTAR}`) {
      next();
      return;
    }
    jsonGeneral(req, res, next);
  });
  app.use(pinoHttp({ logger }));

  // Todos los módulos se montan aquí. /health y la documentación quedan fuera del límite global.
  const apiRouter = Router();
  apiRouter.use(healthRouter);
  apiRouter.use(docsRouter);
  apiRouter.use(rateLimit(fabrica(REGLAS.global), claveUsuarioOIp, { siFalla: 'permitir' }));
  apiRouter.use(crearAuthRouter(fabrica));
  apiRouter.use(crearUsuariosRouter(fabrica));
  apiRouter.use(perfilRouter);
  apiRouter.use(bloquesRouter);
  apiRouter.use(actividadesRouter);

  app.get('/', (_req, res) => {
    res.redirect(302, '/api/v1/docs');
  });
  app.use('/api/v1', apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

const app = createApp();
export default app;
