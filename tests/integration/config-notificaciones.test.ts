import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import {
  bearer,
  crearAppTest,
  limpiarUsuariosDeTest,
  registrar,
  type SesionTest,
} from './helpers.js';

const app = crearAppTest();
afterAll(limpiarUsuariosDeTest);

const ruta = (tipo = '') =>
  tipo ? `/api/v1/config-notificaciones/${tipo}` : '/api/v1/config-notificaciones';
const get = (s: SesionTest, tipo = '') =>
  request(app)
    .get(ruta(tipo))
    .set(...bearer(s));

describe('/config-notificaciones', () => {
  it('al registrarse hay 3 configuraciones activas sin silencio', async () => {
    const res = await get(await registrar(app));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { tipo: 'sueno', activa: true, silencioInicio: null, silencioFin: null },
      { tipo: 'pausa', activa: true, silencioInicio: null, silencioFin: null },
      { tipo: 'logros', activa: true, silencioInicio: null, silencioFin: null },
    ]);
  });

  it('PUT con silencio que cruza medianoche y GET del tipo', async () => {
    const s = await registrar(app);
    const cambio = { activa: false, silencioInicio: '22:00', silencioFin: '07:00' };
    const res = await request(app)
      .put(ruta('pausa'))
      .set(...bearer(s))
      .send(cambio);
    expect(res.status).toBe(200);
    expect((await get(s, 'pausa')).body).toEqual({ tipo: 'pausa', ...cambio });
  });

  it('POST de un tipo que ya existe → 409; tipo inválido → 400', async () => {
    const s = await registrar(app);
    const res = await request(app)
      .post(ruta())
      .set(...bearer(s))
      .send({ tipo: 'sueno', activa: true, silencioInicio: null, silencioFin: null });
    expect(res.status).toBe(409);
    expect((await get(s, 'xyz')).status).toBe(400);
  });

  it('DELETE restablece los valores por defecto (204)', async () => {
    const s = await registrar(app);
    await request(app)
      .put(ruta('logros'))
      .set(...bearer(s))
      .send({ activa: false, silencioInicio: '13:00', silencioFin: '14:00' });
    const res = await request(app)
      .delete(ruta('logros'))
      .set(...bearer(s));
    expect(res.status).toBe(204);
    expect((await get(s, 'logros')).body).toEqual({
      tipo: 'logros',
      activa: true,
      silencioInicio: null,
      silencioFin: null,
    });
  });

  it('POST crea un tipo que faltaba (201)', async () => {
    const s = await registrar(app);
    const { prisma } = await import('../../src/common/db/prisma.js');
    await prisma.configNotificacion.deleteMany({
      where: { idUsuario: s.usuario.idUsuario, tipo: 'logros' },
    });
    expect((await get(s, 'logros')).status).toBe(404);
    const res = await request(app)
      .post(ruta())
      .set(...bearer(s))
      .send({ tipo: 'logros', activa: true, silencioInicio: null, silencioFin: null });
    expect(res.status).toBe(201);
    expect(res.headers.location).toBe('/api/v1/config-notificaciones/logros');
  });
});
