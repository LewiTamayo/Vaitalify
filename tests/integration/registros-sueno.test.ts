import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { hoyEnZona, sumarDias } from '../../src/common/utils/dates.js';
import {
  bearer,
  crearAppTest,
  limpiarUsuariosDeTest,
  registrar,
  type SesionTest,
} from './helpers.js';

const app = crearAppTest();
afterAll(limpiarUsuariosDeTest);

const HOY = hoyEnZona();
const AYER = sumarDias(HOY, -1);

const crear = (s: SesionTest, cuerpo: object) =>
  request(app)
    .post('/api/v1/registros-sueno')
    .set(...bearer(s))
    .send(cuerpo);

describe('/registros-sueno', () => {
  it('crea (201) con horas numéricas; el mismo día otra vez → 409', async () => {
    const s = await registrar(app);
    const res = await crear(s, { fecha: AYER, horasDormidas: 7.5 });
    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/v1/registros-sueno/${res.body.idRegistro}`);
    expect(res.body).toMatchObject({ fecha: AYER, horasDormidas: 7.5 });
    expect((await crear(s, { fecha: AYER, horasDormidas: 6 })).status).toBe(409);
  });

  it.each([
    ['horas no múltiplo de 0.5', { horasDormidas: 7.3 }],
    ['más de 16 horas', { horasDormidas: 16.5 }],
    ['horas negativas', { horasDormidas: -1 }],
    ['fecha inválida', { fecha: '2026-02-30' }],
  ])('%s → 400', async (_caso, cambio) => {
    const res = await crear(await registrar(app), { fecha: AYER, horasDormidas: 7, ...cambio });
    expect(res.status).toBe(400);
  });

  it('una fecha futura en Bogotá → 422', async () => {
    const res = await crear(await registrar(app), { fecha: sumarDias(HOY, 1), horasDormidas: 7 });
    expect(res.status).toBe(422);
  });

  it('PUT reemplaza; mover a una fecha ya registrada → 409', async () => {
    const s = await registrar(app);
    const a = await crear(s, { fecha: AYER, horasDormidas: 7 });
    await crear(s, { fecha: HOY, horasDormidas: 8 });
    const ruta = `/api/v1/registros-sueno/${a.body.idRegistro}`;
    const ok = await request(app)
      .put(ruta)
      .set(...bearer(s))
      .send({ fecha: AYER, horasDormidas: 6.5 });
    expect(ok.status).toBe(200);
    expect(ok.body.horasDormidas).toBe(6.5);
    const choque = await request(app)
      .put(ruta)
      .set(...bearer(s))
      .send({ fecha: HOY, horasDormidas: 6.5 });
    expect(choque.status).toBe(409);
  });

  it('lista por rango, aísla por usuario y elimina', async () => {
    const s = await registrar(app);
    const otro = await registrar(app);
    const { body } = await crear(s, { fecha: AYER, horasDormidas: 7 });
    await crear(s, { fecha: sumarDias(HOY, -5), horasDormidas: 6 });

    const lista = await request(app)
      .get(`/api/v1/registros-sueno?desde=${sumarDias(HOY, -2)}&hasta=${HOY}`)
      .set(...bearer(s));
    expect(lista.body.meta.total).toBe(1);

    const ruta = `/api/v1/registros-sueno/${body.idRegistro}`;
    expect(
      (
        await request(app)
          .get(ruta)
          .set(...bearer(otro))
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .delete(ruta)
          .set(...bearer(s))
      ).status,
    ).toBe(204);
  });

  it('POST con Idempotency-Key repetido devuelve la misma respuesta', async () => {
    const s = await registrar(app);
    const clave = randomUUID();
    const enviar = () =>
      request(app)
        .post('/api/v1/registros-sueno')
        .set(...bearer(s))
        .set('Idempotency-Key', clave)
        .send({ fecha: AYER, horasDormidas: 7 });
    const primera = await enviar();
    const segunda = await enviar();
    expect(primera.status).toBe(201);
    expect(segunda.status).toBe(201);
    expect(segunda.headers['idempotent-replayed']).toBe('true');
    expect(segunda.body).toEqual(primera.body);
  });
});
