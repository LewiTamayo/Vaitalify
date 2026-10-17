import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { config } from 'dotenv';

// Carga .env.test (ramas de Neon locales) sin sobrescribir lo que ya define el entorno (CI).
if (existsSync('.env.test')) {
  config({ path: '.env.test', quiet: true });
}

const defaults: Record<string, string> = {
  APP_ENV: 'test',
  APP_TZ: 'America/Bogota',
  DATABASE_URL: 'postgresql://vitalify:vitalify@localhost:5432/vitalify_test',
  DIRECT_URL: 'postgresql://vitalify:vitalify@localhost:5432/vitalify_test',
  JWT_ACCESS_SECRET: randomBytes(32).toString('hex'),
  JWT_REFRESH_SECRET: randomBytes(32).toString('hex'),
  CORS_ORIGINS: 'http://localhost:5173',
};

for (const [clave, valor] of Object.entries(defaults)) {
  process.env[clave] ??= valor;
}
