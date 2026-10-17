import 'dotenv/config';
import { z } from 'zod';

const ENTORNOS_PUBLICOS = new Set(['preview', 'production']);
const PREFIJO_SECRETO_EJEMPLO = 'cambia-esto';

const opcional = z.string().min(1).optional();

const esquema = z.object({
  APP_ENV: z.enum(['local', 'test', 'perf', 'preview', 'production']).default('local'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_TZ: z.string().min(1).default('America/Bogota'),
  DATABASE_URL: z.string('es obligatoria').min(1, 'es obligatoria'),
  DIRECT_URL: z
    .string('es obligatoria (o DATABASE_URL_UNPOOLED)')
    .min(1, 'es obligatoria (o DATABASE_URL_UNPOOLED)'),
  JWT_ACCESS_SECRET: z.string('es obligatoria').min(1, 'es obligatoria'),
  JWT_REFRESH_SECRET: z.string('es obligatoria').min(1, 'es obligatoria'),
  JWT_ACCESS_TTL: z.string().min(1).default('15m'),
  JWT_REFRESH_TTL: z.string().min(1).default('7d'),
  BCRYPT_COST: z.coerce.number().int().min(10).max(14).default(12),
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((valor) =>
      valor
        .split(',')
        .map((origen) => origen.trim())
        .filter((origen) => origen.length > 0),
    ),
  CRON_SECRET: opcional,
  UPSTASH_REDIS_REST_URL: opcional,
  UPSTASH_REDIS_REST_TOKEN: opcional,
  RATE_LIMIT_ENABLED: z.stringbool().default(true),
  SEED_ADMIN_PASSWORD: opcional,
  SEED_DEMO_PASSWORD: opcional,
  PERF_USERS: z.coerce.number().int().positive().default(500),
  PERF_USER_PASSWORD: opcional,
  MARGEN_PREPARACION_MIN: z.coerce.number().int().min(0).max(240).default(45),
});

export type Env = z.infer<typeof esquema>;

type Entrada = Record<string, string | undefined>;

// Reglas que cruzan variables; se evalúan sobre la entrada cruda para reportar todo de una vez.
function reglasCruzadas(entrada: Entrada): string[] {
  const errores: string[] = [];
  const appEnv = entrada.APP_ENV ?? 'local';
  if (entrada.RATE_LIMIT_ENABLED === 'false' && appEnv !== 'perf') {
    errores.push('RATE_LIMIT_ENABLED (solo puede ser false cuando APP_ENV=perf)');
  }
  if (ENTORNOS_PUBLICOS.has(appEnv)) {
    for (const clave of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
      const valor = entrada[clave] ?? '';
      if (valor.length < 32 || valor.startsWith(PREFIJO_SECRETO_EJEMPLO)) {
        errores.push(
          `${clave} (debe tener al menos 32 caracteres aleatorios en preview/production)`,
        );
      }
    }
  }
  const rateLimitActivo = entrada.RATE_LIMIT_ENABLED !== 'false';
  if (ENTORNOS_PUBLICOS.has(appEnv) && rateLimitActivo) {
    for (const clave of ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN']) {
      if (!entrada[clave]) {
        errores.push(`${clave} (obligatoria en preview/production para el rate limiting)`);
      }
    }
  }
  return errores;
}

// Una variable vacía (`CRON_SECRET=` en .env.example) equivale a no definida.
function sinVacias(raw: Entrada): Entrada {
  return Object.fromEntries(
    Object.entries(raw).filter(([, valor]) => valor !== undefined && valor.trim() !== ''),
  );
}

// Si en Vercel se olvida APP_ENV, se deduce de VERCEL_ENV para no saltarse las reglas de producción.
const APP_ENV_DESDE_VERCEL: Record<string, string> = {
  production: 'production',
  preview: 'preview',
  development: 'local',
};

export function parseEnv(raw: Entrada): Env {
  const limpio = sinVacias(raw);
  const entrada = {
    ...limpio,
    APP_ENV: limpio.APP_ENV ?? APP_ENV_DESDE_VERCEL[limpio.VERCEL_ENV ?? ''],
    DIRECT_URL: limpio.DIRECT_URL ?? limpio.DATABASE_URL_UNPOOLED,
  };
  const resultado = esquema.safeParse(entrada);
  // Solo nombres y motivos: nunca los valores (pueden ser secretos).
  const errores = [
    ...(resultado.success
      ? []
      : resultado.error.issues.map((issue) => `${issue.path.join('.')} (${issue.message})`)),
    ...reglasCruzadas(entrada),
  ];
  if (!resultado.success || errores.length > 0) {
    throw new Error(`Variables de entorno inválidas: ${errores.join(', ')}`);
  }
  return resultado.data;
}

export const env: Env = parseEnv(process.env);
