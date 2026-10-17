import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  bearer,
  crearAppTest,
  limpiarUsuariosDeTest,
  registrar,
  type SesionTest,
} from './helpers.js';

const app = crearAppTest();
afterAll(limpiarUsuariosDeTest);

const clase = {
  tipo: 'estudio',
  titulo: 'Clase de Cálculo',
  diaSemana: 2,
  horaInicio: '07:00',
  horaFin: '09:00',
};

const crear = (s: SesionTest, cuerpo: object = clase) =>
  request(app)
    .post('/api/v1/bloques')
    .set(...bearer(s))
    .send(cuerpo);

const listar = (s: SesionTest, query = '') =>
  request(app)
    .get(`/api/v1/bloques${query}`)
    .set(...bearer(s));

describe('POST /bloques', () => {
  it('crea (201 + Location) con origen manual; los solapados también se aceptan', async () => {
    const s = await registrar(app);
    const res = await crear(s);
    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/v1/bloques/${res.body.idBloque}`);
    expect(res.body).toMatchObject({ ...clase, origen: 'manual' });
    const solapado = await crear(s, { ...clase, horaInicio: '08:00', horaFin: '10:00' });
    expect(solapado.status).toBe(201);
  });

  it('horaFin <= horaInicio → 400 en horaFin', async () => {
    const res = await crear(await registrar(app), { ...clase, horaFin: '06:00' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toContainEqual(expect.objectContaining({ campo: 'horaFin' }));
  });
});

describe('GET /bloques (filtros y paginación)', () => {
  let s: SesionTest;

  beforeAll(async () => {
    s = await registrar(app);
    await crear(s);
    await crear(s, {
      ...clase,
      tipo: 'trabajo',
      titulo: 'Turno',
      horaInicio: '10:00',
      horaFin: '18:00',
    });
    await crear(s, { ...clase, diaSemana: 3 });
  });

  it('filtra por diaSemana y tipo', async () => {
    const res = await listar(s, '?diaSemana=2&tipo=estudio');
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0]).toMatchObject({ diaSemana: 2, tipo: 'estudio' });
  });

  it('pagina y ordena por día y hora', async () => {
    const res = await listar(s, '?page=2&pageSize=1');
    expect(res.body.meta).toEqual({ page: 2, pageSize: 1, total: 3 });
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ diaSemana: 2, horaInicio: '10:00' });
  });

  it('pageSize > 100 → 400', async () => {
    expect((await listar(s, '?pageSize=101')).status).toBe(400);
  });
});

describe('/bloques/:id', () => {
  it('id no numérico o fuera de rango → 400', async () => {
    const s = await registrar(app);
    expect((await listar(s, '/abc')).status).toBe(400);
    expect((await listar(s, '/99999999999')).status).toBe(400);
  });

  it('PATCH valida el orden de horas sobre el bloque combinado', async () => {
    const s = await registrar(app);
    const { body } = await crear(s);
    const ruta = `/api/v1/bloques/${body.idBloque}`;
    const malo = await request(app)
      .patch(ruta)
      .set(...bearer(s))
      .send({ horaInicio: '10:00' });
    expect(malo.status).toBe(400);
    expect(malo.body.errors).toContainEqual(expect.objectContaining({ campo: 'horaFin' }));

    const bueno = await request(app)
      .patch(ruta)
      .set(...bearer(s))
      .send({ titulo: 'Nuevo' });
    expect(bueno.status).toBe(200);
    expect(bueno.body).toMatchObject({ ...clase, titulo: 'Nuevo' });
  });

  it('PUT reemplaza y DELETE elimina (204); después GET → 404', async () => {
    const s = await registrar(app);
    const { body } = await crear(s);
    const ruta = `/api/v1/bloques/${body.idBloque}`;
    const nuevo = { ...clase, tipo: 'viaje', titulo: 'Bus', horaInicio: '06:00', horaFin: '06:45' };
    const put = await request(app)
      .put(ruta)
      .set(...bearer(s))
      .send(nuevo);
    expect(put.status).toBe(200);
    expect(put.body).toMatchObject(nuevo);
    expect(
      (
        await request(app)
          .delete(ruta)
          .set(...bearer(s))
      ).status,
    ).toBe(204);
    expect((await listar(s, `/${body.idBloque}`)).status).toBe(404);
  });

  it('otro usuario recibe 404 en GET/PUT/PATCH/DELETE y no puede modificar el bloque', async () => {
    const a = await registrar(app);
    const b = await registrar(app);
    const { body } = await crear(a);
    const ruta = `/api/v1/bloques/${body.idBloque}`;

    const respuestas = await Promise.all([
      request(app)
        .get(ruta)
        .set(...bearer(b)),
      request(app)
        .put(ruta)
        .set(...bearer(b))
        .send(clase),
      request(app)
        .patch(ruta)
        .set(...bearer(b))
        .send({ titulo: 'Hackeado' }),
      request(app)
        .delete(ruta)
        .set(...bearer(b)),
    ]);
    expect(respuestas.map((r) => r.status)).toEqual([404, 404, 404, 404]);

    const original = await listar(a, `/${body.idBloque}`);
    expect(original.status).toBe(200);
    expect(original.body.titulo).toBe(clase.titulo);
    expect((await listar(b)).body.meta.total).toBe(0);
  });

  it('sin token → 401', async () => {
    expect((await request(app).get('/api/v1/bloques')).status).toBe(401);
  });
});
