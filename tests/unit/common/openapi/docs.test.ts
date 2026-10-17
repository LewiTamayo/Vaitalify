import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/common/db/prisma.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  prisma: { $queryRaw: vi.fn() },
}));

const { default: app } = await import('../../../../src/app.js');

describe('OpenAPI y Swagger UI', () => {
  it('GET /api/v1/openapi.json → documento OpenAPI 3.1 con /health', async () => {
    const res = await request(app).get('/api/v1/openapi.json');
    expect(res.status).toBe(200);
    expect(String(res.body.openapi)).toMatch(/^3\.1/);
    expect(res.body.info.title).toBe('Vitalify API');
    expect(res.body.paths['/health']).toBeDefined();
    for (const ruta of ['/auth/registro', '/auth/login', '/auth/refresh', '/auth/logout']) {
      expect(res.body.paths[ruta]?.post).toBeDefined();
    }
    expect(res.body.components.schemas.Sesion).toBeDefined();
    expect(res.body.components.securitySchemes.bearerAuth).toBeDefined();
  });

  it('GET /api/v1/docs → HTML de Swagger UI desde CDN con CSP que lo permite', async () => {
    const res = await request(app).get('/api/v1/docs');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('cdn.jsdelivr.net/npm/swagger-ui-dist@5.33.3');
    expect(res.headers['content-security-policy']).toContain('cdn.jsdelivr.net');
  });

  it('las demás rutas conservan la CSP estricta de helmet', async () => {
    const res = await request(app).get('/api/v1/openapi.json');
    expect(res.headers['content-security-policy']).not.toContain('cdn.jsdelivr.net');
  });
});
