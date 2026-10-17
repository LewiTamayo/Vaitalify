import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../../../../src/common/errors/error-handler.js';
import { claveUsuarioOIp, requireAuth } from '../../../../src/common/middleware/auth.js';
import { requireRole } from '../../../../src/common/middleware/require-role.js';
import { firmarAccess } from '../../../../src/common/security/tokens.js';

function crearApp() {
  const app = express();
  app.get('/yo', requireAuth, (req, res) => {
    res.json(req.usuario);
  });
  app.get('/admin', requireAuth, requireRole('admin'), (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/clave', async (req, res) => {
    res.json({ clave: await claveUsuarioOIp(req) });
  });
  app.use(errorHandler);
  return app;
}

describe('requireAuth', () => {
  it('sin Authorization → 401 problem+json', async () => {
    const res = await request(crearApp()).get('/yo');
    expect(res.status).toBe(401);
    expect(res.body.type).toBe('https://vitalify.app/errors/no-autenticado');
  });

  it('token basura → 401', async () => {
    const res = await request(crearApp()).get('/yo').set('authorization', 'Bearer basura');
    expect(res.status).toBe(401);
  });

  it('token válido → req.usuario', async () => {
    const token = await firmarAccess(7, 'user');
    const res = await request(crearApp()).get('/yo').set('authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ idUsuario: 7, rol: 'user' });
  });
});

describe('requireRole', () => {
  it('rol user → 403; admin → 200', async () => {
    const user = await firmarAccess(7, 'user');
    const admin = await firmarAccess(1, 'admin');
    expect(
      (await request(crearApp()).get('/admin').set('authorization', `Bearer ${user}`)).status,
    ).toBe(403);
    expect(
      (await request(crearApp()).get('/admin').set('authorization', `Bearer ${admin}`)).status,
    ).toBe(200);
  });
});

describe('claveUsuarioOIp', () => {
  it('usa el usuario si el bearer es válido y la IP si no', async () => {
    const token = await firmarAccess(7, 'user');
    const conToken = await request(crearApp())
      .get('/clave')
      .set('authorization', `Bearer ${token}`);
    expect(conToken.body.clave).toBe('usuario:7');
    const sinToken = await request(crearApp()).get('/clave').set('x-forwarded-for', '10.1.1.1');
    expect(sinToken.body.clave).toBe('ip:10.1.1.1');
  });
});
