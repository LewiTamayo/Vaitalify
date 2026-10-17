import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

const queryRaw = vi.fn();
vi.mock('../../../../src/common/db/prisma.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  prisma: { $queryRaw: queryRaw },
}));

const { default: app } = await import('../../../../src/app.js');
const { comprobarBaseDatos } = await import('../../../../src/modules/health/health.service.js');

afterEach(() => {
  queryRaw.mockReset();
  vi.useRealTimers();
});

describe('GET /api/v1/health', () => {
  it('BD disponible → 200 ok/up', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'up' });
  });

  it('BD con error → 503 degraded/down', async () => {
    queryRaw.mockRejectedValue(new Error('connection refused'));
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'degraded', db: 'down' });
  });
});

describe('app', () => {
  it('ruta inexistente bajo /api/v1 → 404 problem+json', async () => {
    const res = await request(app).get('/api/v1/x');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
  });

  it('GET / redirige a la documentación', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/api/v1/docs');
  });
});

describe('comprobarBaseDatos', () => {
  it('BD que no responde → false al vencer el timeout (no cuelga la función)', async () => {
    vi.useFakeTimers();
    queryRaw.mockReturnValue(new Promise(() => undefined));
    const resultado = comprobarBaseDatos(3000);
    await vi.advanceTimersByTimeAsync(2999);
    let resuelto = false;
    void resultado.then(() => (resuelto = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(resuelto).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(resultado).resolves.toBe(false);
  });
});
