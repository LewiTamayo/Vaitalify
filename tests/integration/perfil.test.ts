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

const perfil = {
  horaDormir: '22:45',
  horaDespertar: '06:15',
  metaHorasSueno: 7.5,
  metaMinActividad: 150,
};

function enviar(s: SesionTest, metodo: 'post' | 'put' | 'patch', cuerpo: object) {
  const cliente = request(app);
  return cliente[metodo]('/api/v1/perfil')
    .set(...bearer(s))
    .send(cuerpo);
}
const obtener = (s: SesionTest) =>
  request(app)
    .get('/api/v1/perfil')
    .set(...bearer(s));

describe('/perfil', () => {
  it('GET sin perfil → 404 con indicación del siguiente paso', async () => {
    const res = await obtener(await registrar(app));
    expect(res.status).toBe(404);
    expect(res.body.hint).toMatch(/POST \/perfil/);
  });

  it('POST crea el perfil (201) con horas HH:mm y decimales numéricos; un segundo POST → 409', async () => {
    const s = await registrar(app);
    const res = await enviar(s, 'post', perfil);
    expect(res.status).toBe(201);
    expect(res.headers.location).toBe('/api/v1/perfil');
    expect(res.body).toMatchObject(perfil);
    expect(typeof res.body.metaHorasSueno).toBe('number');
    expect((await enviar(s, 'post', perfil)).status).toBe(409);
  });

  it('PATCH actualiza un campo y conserva el resto', async () => {
    const s = await registrar(app);
    await enviar(s, 'post', perfil);
    const res = await enviar(s, 'patch', { metaHorasSueno: 8 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ...perfil, metaHorasSueno: 8 });
  });

  it('PATCH que iguala horaDespertar a horaDormir → 400', async () => {
    const s = await registrar(app);
    await enviar(s, 'post', perfil);
    expect((await enviar(s, 'patch', { horaDespertar: '22:45' })).status).toBe(400);
  });

  it('PUT reemplaza; sin perfil → 404', async () => {
    const s = await registrar(app);
    expect((await enviar(s, 'put', perfil)).status).toBe(404);
    await enviar(s, 'post', perfil);
    const nuevo = {
      horaDormir: '23:00',
      horaDespertar: '06:00',
      metaHorasSueno: 7,
      metaMinActividad: 200,
    };
    const res = await enviar(s, 'put', nuevo);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject(nuevo);
  });

  it('DELETE elimina (204) y luego GET → 404', async () => {
    const s = await registrar(app);
    await enviar(s, 'post', perfil);
    expect(
      (
        await request(app)
          .delete('/api/v1/perfil')
          .set(...bearer(s))
      ).status,
    ).toBe(204);
    expect((await obtener(s)).status).toBe(404);
    expect(
      (
        await request(app)
          .delete('/api/v1/perfil')
          .set(...bearer(s))
      ).status,
    ).toBe(404);
  });

  it('cada usuario solo ve su propio perfil; sin token → 401', async () => {
    const a = await registrar(app);
    const b = await registrar(app);
    await enviar(a, 'post', perfil);
    expect((await obtener(b)).status).toBe(404);
    expect((await request(app).get('/api/v1/perfil')).status).toBe(401);
  });
});
