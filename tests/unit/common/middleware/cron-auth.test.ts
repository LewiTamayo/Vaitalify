import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../../../../src/common/errors/error-handler.js';
import { crearCronAuth } from '../../../../src/common/middleware/cron-auth.js';

const SECRETO = 'un-secreto-de-cron-suficientemente-largo-123';

function crearApp(secreto: string | undefined) {
  const app = express();
  app.get('/job', crearCronAuth(secreto), (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);
  return app;
}

describe('cronAuth', () => {
  it('acepta el secreto correcto', async () => {
    const res = await request(crearApp(SECRETO))
      .get('/job')
      .set('authorization', `Bearer ${SECRETO}`);
    expect(res.status).toBe(200);
  });

  it.each([
    ['sin cabecera', undefined],
    ['otro secreto de la misma longitud', `Bearer ${'x'.repeat(SECRETO.length)}`],
    ['secreto de distinta longitud', 'Bearer corto'],
    ['sin el prefijo Bearer', SECRETO],
  ])('rechaza %s con 401', async (_caso, cabecera) => {
    const req = request(crearApp(SECRETO)).get('/job');
    if (cabecera) req.set('authorization', cabecera);
    expect((await req).status).toBe(401);
  });

  it('sin CRON_SECRET configurado rechaza siempre (incluso "Bearer undefined")', async () => {
    const app = crearApp(undefined);
    expect((await request(app).get('/job').set('authorization', 'Bearer undefined')).status).toBe(
      401,
    );
    expect((await request(app).get('/job').set('authorization', 'Bearer ')).status).toBe(401);
  });
});
