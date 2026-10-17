import app from './app.js';
import { logger } from './common/logger.js';
import { env } from './config/env.js';

// Solo desarrollo local: Vercel usa src/app.ts directamente.
app.listen(env.PORT, () => {
  logger.info(`Vitalify API escuchando en http://localhost:${env.PORT}/api/v1/docs`);
});
