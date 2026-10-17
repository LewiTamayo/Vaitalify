import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { errorHandler } from '../../../../src/common/errors/error-handler.js';
import { validate } from '../../../../src/common/middleware/validate.js';

function crearApp() {
  const app = express();
  app.use(express.json());
  app.post(
    '/bloques/:id',
    validate({
      body: z.object({ horaFin: z.string() }).strict(),
      params: z.object({ id: z.coerce.number().int().positive() }),
      query: z.object({ page: z.coerce.number().int().default(1) }),
    }),
    (req, res) => {
      res.json(req.valid);
    },
  );
  app.use(errorHandler);
  return app;
}

describe('validate', () => {
  it('deja los datos parseados en req.valid', async () => {
    const res = await request(crearApp()).post('/bloques/7?page=2').send({ horaFin: '09:00' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ body: { horaFin: '09:00' }, params: { id: 7 }, query: { page: 2 } });
  });

  it('campos desconocidos o faltantes → 400 validation con errores por campo', async () => {
    const res = await request(crearApp()).post('/bloques/7').send({ extra: 1 });
    expect(res.status).toBe(400);
    expect(res.body.type).toBe('https://vitalify.app/errors/validation');
    expect(res.body.title).toBe('Datos inválidos');
    const campos = (res.body.errors as { campo: string }[]).map((e) => e.campo);
    expect(campos).toContain('horaFin');
  });

  it('params inválidos → 400', async () => {
    const res = await request(crearApp()).post('/bloques/abc').send({ horaFin: '09:00' });
    expect(res.status).toBe(400);
    expect((res.body.errors as { campo: string }[])[0]?.campo).toBe('id');
  });
});
