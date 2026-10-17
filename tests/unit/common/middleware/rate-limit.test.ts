import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../../../../src/common/errors/error-handler.js';
import { ipCliente } from '../../../../src/common/http/ip.js';
import { rateLimit } from '../../../../src/common/middleware/rate-limit.js';
import { crearLimitadorMemoria } from '../../../../src/common/ratelimit/memoria.js';

function crearApp() {
  const app = express();
  const limitador = crearLimitadorMemoria({ nombre: 't', limite: 1, ventanaSeg: 60 });
  app.get('/x', rateLimit(limitador, ipCliente), (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);
  return app;
}

describe('rateLimit', () => {
  it('responde 429 problem+json con Retry-After al superar el límite', async () => {
    const app = crearApp();
    const ip = '10.0.0.1';
    expect((await request(app).get('/x').set('x-forwarded-for', ip)).status).toBe(200);
    const res = await request(app).get('/x').set('x-forwarded-for', ip);
    expect(res.status).toBe(429);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(res.body.type).toBe('https://vitalify.app/errors/demasiadas-peticiones');
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('la clave es la IP del cliente (primer x-forwarded-for), no la del proxy', async () => {
    const app = crearApp();
    await request(app).get('/x').set('x-forwarded-for', '10.0.0.1, 10.0.0.9');
    const otraIp = await request(app).get('/x').set('x-forwarded-for', '10.0.0.2, 10.0.0.9');
    expect(otraIp.status).toBe(200);
    const mismaIp = await request(app).get('/x').set('x-forwarded-for', '10.0.0.1, 10.0.0.7');
    expect(mismaIp.status).toBe(429);
  });
});
