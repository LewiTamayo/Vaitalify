import { describe, expect, it } from 'vitest';
import { parseEnv } from '../../../src/config/env.js';

const SECRETO_A = 'a'.repeat(40);
const SECRETO_B = 'b'.repeat(40);

const base = {
  APP_ENV: 'local',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  DIRECT_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: SECRETO_A,
  JWT_REFRESH_SECRET: SECRETO_B,
  CORS_ORIGINS: 'http://localhost:5173, https://app.vitalify.dev ,',
  UPSTASH_REDIS_REST_URL: 'https://base.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'token-base',
};

describe('parseEnv', () => {
  it('aplica defaults y convierte CORS_ORIGINS en lista', () => {
    const env = parseEnv(base);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:5173', 'https://app.vitalify.dev']);
    expect(env.APP_TZ).toBe('America/Bogota');
    expect(env.PORT).toBe(3000);
    expect(env.BCRYPT_COST).toBe(12);
    expect(env.MARGEN_PREPARACION_MIN).toBe(45);
    expect(env.RATE_LIMIT_ENABLED).toBe(true);
  });

  it('usa DATABASE_URL_UNPOOLED como DIRECT_URL (Neon Marketplace)', () => {
    const env = parseEnv({
      ...base,
      DIRECT_URL: undefined,
      DATABASE_URL_UNPOOLED: 'postgresql://u:p@direct:5432/db',
    });
    expect(env.DIRECT_URL).toBe('postgresql://u:p@direct:5432/db');
  });

  it('exige DATABASE_URL', () => {
    expect(() => parseEnv({ ...base, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
  });

  it('solo permite RATE_LIMIT_ENABLED=false en perf', () => {
    expect(() => parseEnv({ ...base, APP_ENV: 'production', RATE_LIMIT_ENABLED: 'false' })).toThrow(
      /RATE_LIMIT_ENABLED/,
    );
    expect(() => parseEnv({ ...base, APP_ENV: 'local', RATE_LIMIT_ENABLED: 'false' })).toThrow(
      /RATE_LIMIT_ENABLED/,
    );
    expect(
      parseEnv({ ...base, APP_ENV: 'perf', RATE_LIMIT_ENABLED: 'false' }).RATE_LIMIT_ENABLED,
    ).toBe(false);
  });

  it('rechaza secretos de ejemplo o cortos en production', () => {
    expect(() =>
      parseEnv({ ...base, APP_ENV: 'production', JWT_ACCESS_SECRET: 'cambia-esto' }),
    ).toThrow(/JWT_ACCESS_SECRET/);
    expect(() => parseEnv({ ...base, APP_ENV: 'preview', JWT_REFRESH_SECRET: 'corto' })).toThrow(
      /JWT_REFRESH_SECRET/,
    );
    expect(parseEnv({ ...base, APP_ENV: 'production' }).APP_ENV).toBe('production');
  });

  it('el mensaje de error nunca incluye el valor del secreto', () => {
    const valor = 's3cr3t-valor-unico';
    let mensaje = '';
    try {
      parseEnv({
        ...base,
        APP_ENV: 'production',
        JWT_REFRESH_SECRET: valor,
        DATABASE_URL: undefined,
      });
    } catch (e) {
      mensaje = (e as Error).message;
    }
    expect(mensaje).toMatch(/JWT_REFRESH_SECRET/);
    expect(mensaje).toMatch(/DATABASE_URL/);
    expect(mensaje).not.toContain(valor);
  });

  it('trata las variables vacías (como en .env.example) como no definidas', () => {
    const env = parseEnv({ ...base, CRON_SECRET: '', UPSTASH_REDIS_REST_URL: '', PERF_USERS: '' });
    expect(env.CRON_SECRET).toBeUndefined();
    expect(env.PERF_USERS).toBe(500);
  });

  it('rechaza APP_ENV desconocido', () => {
    expect(() => parseEnv({ ...base, APP_ENV: 'staging' })).toThrow(/APP_ENV/);
  });
});

describe('parseEnv en Vercel', () => {
  it('sin APP_ENV, usa VERCEL_ENV y aplica las reglas de production', () => {
    const sinAppEnv = { ...base, APP_ENV: undefined };
    expect(() =>
      parseEnv({ ...sinAppEnv, VERCEL_ENV: 'production', JWT_ACCESS_SECRET: 'cambia-esto' }),
    ).toThrow(/JWT_ACCESS_SECRET/);
    expect(parseEnv({ ...sinAppEnv, VERCEL_ENV: 'preview' }).APP_ENV).toBe('preview');
  });

  it('VERCEL_ENV=development se trata como local', () => {
    const sinAppEnv = { ...base, APP_ENV: undefined };
    expect(parseEnv({ ...sinAppEnv, VERCEL_ENV: 'development' }).APP_ENV).toBe('local');
  });
});

describe('parseEnv: Upstash en entornos públicos', () => {
  it('exige credenciales de Upstash en production con rate limit activo', () => {
    const sinUpstash = {
      ...base,
      UPSTASH_REDIS_REST_URL: undefined,
      UPSTASH_REDIS_REST_TOKEN: undefined,
    };
    expect(() => parseEnv({ ...sinUpstash, APP_ENV: 'production' })).toThrow(
      /UPSTASH_REDIS_REST_URL/,
    );
    expect(parseEnv({ ...sinUpstash, APP_ENV: 'perf', RATE_LIMIT_ENABLED: 'false' }).APP_ENV).toBe(
      'perf',
    );
  });

  it('acepta production con credenciales de Upstash', () => {
    const env = parseEnv({
      ...base,
      APP_ENV: 'production',
      UPSTASH_REDIS_REST_URL: 'https://x.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'token',
    });
    expect(env.UPSTASH_REDIS_REST_URL).toBe('https://x.upstash.io');
  });
});
