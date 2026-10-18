import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/common/db/prisma.js';
import { hoyEnZona } from '../../src/common/utils/dates.js';
import { bearer, crearAppTest, limpiarUsuariosDeTest, registrar } from './helpers.js';

const app = crearAppTest();
afterAll(limpiarUsuariosDeTest);

const cron = () => ['authorization', `Bearer ${process.env.CRON_SECRET}`] as [string, string];

describe('/jobs (Vercel Cron)', () => {
  it('sin el secreto → 401', async () => {
    expect((await request(app).get('/api/v1/jobs/limpieza')).status).toBe(401);
    const otro = await request(app)
      .get('/api/v1/jobs/generar-recordatorios')
      .set('authorization', 'Bearer otro');
    expect(otro.status).toBe(401);
  });

  it('limpieza: borra claves de idempotencia de más de 24 h y refresh tokens vencidos', async () => {
    const s = await registrar(app);
    const id = s.usuario.idUsuario;
    const hace25h = new Date(Date.now() - 25 * 3_600_000);
    await prisma.idempotencyKey.create({
      data: {
        clave: `${id}:vieja`,
        metodoRuta: 'X',
        codigo: 200,
        respuesta: {},
        creadaEn: hace25h,
      },
    });
    await prisma.refreshToken.create({
      data: { idUsuario: id, tokenHash: `vencido-${id}`.padEnd(64, '0'), expiraEn: hace25h },
    });

    const res = await request(app)
      .get('/api/v1/jobs/limpieza')
      .set(...cron());
    expect(res.status).toBe(200);
    expect(res.body.idempotencia).toBeGreaterThanOrEqual(1);
    expect(res.body.refreshTokens).toBeGreaterThanOrEqual(1);
    expect(await prisma.idempotencyKey.count({ where: { clave: `${id}:vieja` } })).toBe(0);
    // El refresh token vigente del registro sigue existiendo.
    expect(await prisma.refreshToken.count({ where: { idUsuario: id } })).toBe(1);
  });

  it('limpieza conserva los revocados aún vigentes (detección de reutilización de tokens)', async () => {
    const s = await registrar(app);
    // Rotar el refresh token deja el original revocado pero sin vencer.
    await request(app).post('/api/v1/auth/refresh').send({ refreshToken: s.refreshToken });
    await request(app)
      .get('/api/v1/jobs/limpieza')
      .set(...cron());
    // Reutilizar el token rotado sigue detectándose: 401 y se cierran todas las sesiones.
    const reuso = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: s.refreshToken });
    expect(reuso.status).toBe(401);
    const vigentes = await prisma.refreshToken.count({
      where: { idUsuario: s.usuario.idUsuario, revocado: false },
    });
    expect(vigentes).toBe(0);
  });

  it('generar-recordatorios: procesa a los usuarios con perfil y es idempotente', async () => {
    const s = await registrar(app);
    await request(app)
      .post('/api/v1/perfil')
      .set(...bearer(s))
      .send({
        horaDormir: '22:45',
        horaDespertar: '06:15',
        metaHorasSueno: 7.5,
        metaMinActividad: 150,
      });
    const llamar = () =>
      request(app)
        .get('/api/v1/jobs/generar-recordatorios')
        .set(...cron());

    const primera = await llamar();
    expect(primera.status).toBe(200);
    expect(primera.body.usuarios).toBeGreaterThanOrEqual(1);
    await llamar();

    const recordatorios = await request(app)
      .get(`/api/v1/recordatorios?desde=${hoyEnZona()}&hasta=${hoyEnZona()}&tipo=sueno`)
      .set(...bearer(s));
    expect(recordatorios.body.meta.total).toBe(2);
  });
});
