import cors from 'cors';
import express, { Router, type Express } from 'express';
import { helmet } from './common/middleware/helmet.js';
import { pinoHttp } from 'pino-http';
import { errorHandler, notFoundHandler } from './common/errors/error-handler.js';
import { logger } from './common/logger.js';
import { docsRouter } from './common/openapi/docs.js';
import { env } from './config/env.js';
import { healthRouter } from './modules/health/health.routes.js';

// ENTRY DE VERCEL: exporta la app sin llamar listen (ver src/local.ts para desarrollo).
export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS }));
  app.use(express.json({ limit: '100kb' }));
  app.use(pinoHttp({ logger }));

  // Todos los módulos se montan aquí.
  const apiRouter = Router();
  apiRouter.use(healthRouter);
  apiRouter.use(docsRouter);

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
