import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { errores } from '../../../../src/common/errors/app-error.js';
import { errorHandler, notFoundHandler } from '../../../../src/common/errors/error-handler.js';

function crearApp() {
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.post('/eco', (req, res) => {
    res.json(req.body);
  });
  app.get('/regla', () => {
    throw errores.reglaNegocio('Configura tu perfil primero', 'POST /perfil');
  });
  app.get('/conflicto', () => {
    throw errores.conflicto('El correo ya está registrado');
  });
  app.get('/boom', () => {
    throw new Error('boom');
  });
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

const PROBLEM = /application\/problem\+json/;
const appEnvOriginal = process.env.APP_ENV;

afterEach(() => {
  process.env.APP_ENV = appEnvOriginal;
});

describe('errorHandler (RFC 7807)', () => {
  it('ruta inexistente → 404 problem+json', async () => {
    const res = await request(crearApp()).get('/no-existe');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(PROBLEM);
    expect(res.body).toMatchObject({
      type: 'https://vitalify.app/errors/no-encontrado',
      title: 'Recurso no encontrado',
      status: 404,
    });
  });

  it('JSON malformado → 400 json-invalido', async () => {
    const res = await request(crearApp())
      .post('/eco')
      .set('content-type', 'application/json')
      .send('{"a":');
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(PROBLEM);
    expect(res.body.type).toBe('https://vitalify.app/errors/json-invalido');
  });

  it('body mayor a 100 kB → 413', async () => {
    const res = await request(crearApp())
      .post('/eco')
      .send({ texto: 'x'.repeat(150 * 1024) });
    expect(res.status).toBe(413);
    expect(res.body.type).toBe('https://vitalify.app/errors/payload-demasiado-grande');
  });

  it('regla de negocio → 422 con hint', async () => {
    const res = await request(crearApp()).get('/regla');
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      type: 'https://vitalify.app/errors/regla-negocio',
      detail: 'Configura tu perfil primero',
      hint: 'POST /perfil',
    });
  });

  it('conflicto → 409', async () => {
    const res = await request(crearApp()).get('/conflicto');
    expect(res.status).toBe(409);
    expect(res.body.detail).toBe('El correo ya está registrado');
  });

  it('error inesperado en production → 500 sin detalles internos', async () => {
    process.env.APP_ENV = 'production';
    const res = await request(crearApp()).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.type).toBe('https://vitalify.app/errors/interno');
    expect(JSON.stringify(res.body)).not.toContain('boom');
    expect(res.body.stack).toBeUndefined();
  });

  it('error inesperado en local → 500 con el mensaje como detail', async () => {
    process.env.APP_ENV = 'local';
    const res = await request(crearApp()).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.detail).toBe('boom');
  });
});
