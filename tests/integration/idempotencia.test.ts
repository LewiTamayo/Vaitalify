import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { hoyEnZona, isoWeekday } from '../../src/common/utils/dates.js';
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

// Usuario con dos micro-pausas pendientes hoy (ventanas 06:15 y 12:00).
async function dosPausas(): Promise<{ s: SesionTest; ids: number[] }> {
  const s = await registrar(app);
  const auth = bearer(s);
  await request(app)
    .post('/api/v1/perfil')
    .set(...auth)
    .send({
      horaDormir: '22:45',
      horaDespertar: '06:15',
      metaHorasSueno: 7.5,
      metaMinActividad: 150,
    });
  await request(app)
    .post('/api/v1/bloques')
    .set(...auth)
    .send({
      tipo: 'trabajo',
      titulo: 'T',
      diaSemana: isoWeekday(HOY),
      horaInicio: '06:30',
      horaFin: '12:00',
    });
  const ventanas = (
    await request(app)
      .get(`/api/v1/micro-ventanas?desde=${HOY}&hasta=${HOY}`)
      .set(...auth)
  ).body.data as { idVentana: number }[];
  const ids: number[] = [];
  for (const v of ventanas.slice(0, 2)) {
    const res = await request(app)
      .post(`/api/v1/micro-ventanas/${v.idVentana}/micro-pausa`)
      .set(...auth)
      .send({});
    ids.push(res.body.idPausa as number);
  }
  return { s, ids };
}

const marcar = (s: SesionTest, idPausa: number, clave?: string) => {
  const req = request(app)
    .patch(`/api/v1/micro-pausas/${idPausa}`)
    .set(...bearer(s));
  if (clave) req.set('Idempotency-Key', clave);
  return req.send({ estado: 'hecha' });
};

describe('Idempotency-Key en PATCH /micro-pausas/:id', () => {
  it('un reintento con la misma clave devuelve la misma respuesta sin repetir efectos', async () => {
    const { s, ids } = await dosPausas();
    const clave = randomUUID();
    const primera = await marcar(s, ids[0]!, clave);
    expect(primera.status).toBe(200);
    expect(primera.headers['idempotent-replayed']).toBeUndefined();

    const segunda = await marcar(s, ids[0]!, clave);
    expect(segunda.status).toBe(200);
    expect(segunda.headers['idempotent-replayed']).toBe('true');
    expect(segunda.body).toEqual(primera.body);

    const actual = await request(app)
      .get(`/api/v1/micro-pausas/${ids[0]}`)
      .set(...bearer(s));
    expect(actual.body.fechaRegistro).toBe(primera.body.fechaRegistro);
  });

  it('la misma clave en otra micro-pausa → 422', async () => {
    const { s, ids } = await dosPausas();
    const clave = randomUUID();
    await marcar(s, ids[0]!, clave);
    const res = await marcar(s, ids[1]!, clave);
    expect(res.status).toBe(422);
  });

  it('clave con caracteres inválidos o demasiado larga → 400', async () => {
    const { s, ids } = await dosPausas();
    expect((await marcar(s, ids[0]!, 'con espacios')).status).toBe(400);
    expect((await marcar(s, ids[0]!, 'x'.repeat(65))).status).toBe(400);
  });

  it('sin clave funciona normal; la misma clave de otro usuario no colisiona', async () => {
    const a = await dosPausas();
    const b = await dosPausas();
    expect((await marcar(a.s, a.ids[0]!)).status).toBe(200);
    const clave = randomUUID();
    expect((await marcar(a.s, a.ids[1]!, clave)).status).toBe(200);
    const otra = await marcar(b.s, b.ids[0]!, clave);
    expect(otra.status).toBe(200);
    expect(otra.headers['idempotent-replayed']).toBeUndefined();
  });
});
