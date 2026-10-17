import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { bearer, crearAdmin, crearAppTest, limpiarUsuariosDeTest, registrar } from './helpers.js';

const app = crearAppTest();
afterAll(limpiarUsuariosDeTest);

const nueva = {
  nombre: `Prueba ${Date.now()}`,
  categoria: 'estiramiento',
  duracionMin: 3,
  instrucciones: '1. Respira.\n2. Estira.',
};

describe('GET /actividades', () => {
  it('cualquier usuario ve el catálogo sembrado y puede filtrarlo', async () => {
    const s = await registrar(app);
    const todas = await request(app)
      .get('/api/v1/actividades?pageSize=100')
      .set(...bearer(s));
    expect(todas.status).toBe(200);
    expect(todas.body.meta.total).toBeGreaterThanOrEqual(8);

    const filtradas = await request(app)
      .get('/api/v1/actividades?categoria=caminata&maxDuracionMin=10')
      .set(...bearer(s));
    expect(filtradas.body.data.length).toBeGreaterThan(0);
    for (const a of filtradas.body.data as { categoria: string; duracionMin: number }[]) {
      expect(a.categoria).toBe('caminata');
      expect(a.duracionMin).toBeLessThanOrEqual(10);
    }
  });

  it('detalle inexistente → 404; sin token → 401', async () => {
    const s = await registrar(app);
    const res = await request(app)
      .get('/api/v1/actividades/2147483647')
      .set(...bearer(s));
    expect(res.status).toBe(404);
    expect((await request(app).get('/api/v1/actividades')).status).toBe(401);
  });
});

describe('escritura del catálogo', () => {
  it('un usuario normal no puede crear actividades (403)', async () => {
    const s = await registrar(app);
    const res = await request(app)
      .post('/api/v1/actividades')
      .set(...bearer(s))
      .send(nueva);
    expect(res.status).toBe(403);
  });

  it('el admin crea, actualiza y elimina', async () => {
    const admin = await crearAdmin(app);
    const creada = await request(app)
      .post('/api/v1/actividades')
      .set(...bearer(admin))
      .send(nueva);
    expect(creada.status).toBe(201);
    expect(creada.headers.location).toBe(`/api/v1/actividades/${creada.body.idActividad}`);
    const ruta = `/api/v1/actividades/${creada.body.idActividad}`;

    const parche = await request(app)
      .patch(ruta)
      .set(...bearer(admin))
      .send({ duracionMin: 4 });
    expect(parche.status).toBe(200);
    expect(parche.body.duracionMin).toBe(4);

    const reemplazo = await request(app)
      .put(ruta)
      .set(...bearer(admin))
      .send({ ...nueva, nombre: `${nueva.nombre} v2` });
    expect(reemplazo.status).toBe(200);

    expect(
      (
        await request(app)
          .delete(ruta)
          .set(...bearer(admin))
      ).status,
    ).toBe(204);
  });
});
