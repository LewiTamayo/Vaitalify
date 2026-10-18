import { randomBytes } from 'node:crypto';

// Entorno de las pruebas de rendimiento (spec §19.1, U-2): rama `perf` de Neon (.env.perf),
// APP_ENV=perf y sin rate limit, para medir la aplicación y no el limitador.
// Debe importarse ANTES que cualquier módulo de src/ (src/config/env.ts valida al cargar).
process.env.DOTENV_CONFIG_PATH ??= '.env.perf';
process.env.APP_ENV = 'perf';
process.env.RATE_LIMIT_ENABLED = 'false';
// Pool más grande que el default (10): en local cada consulta paga ~88 ms de red hasta Neon y
// con 10 conexiones la API se queda esperando conexión libre (docs/RENDIMIENTO.md, mejora 1).
process.env.DB_POOL_MAX ??= '40';
// Los tokens de una corrida de JMeter no necesitan sobrevivir a la API: secretos efímeros.
process.env.JWT_ACCESS_SECRET ??= randomBytes(32).toString('hex');
process.env.JWT_REFRESH_SECRET ??= randomBytes(32).toString('hex');
