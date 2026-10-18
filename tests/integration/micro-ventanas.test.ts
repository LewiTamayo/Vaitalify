import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { hoyEnZona, isoWeekday, sumarDias } from '../../src/common/utils/dates.js';
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
const PERFIL = {
  horaDormir: '22:45',
  horaDespertar: '06:15',
  metaHorasSueno: 7.5,
  metaMinActividad: 150,
};

async function usuarioConPerfil(): Promise<SesionTest> {
  const s = await registrar(app);
  await request(app)
    .post('/api/v1/perfil')
    .set(...bearer(s))
    .send(PERFIL);
  return s;
}

const ventanasDe = async (s: SesionTest, fecha = HOY) =>
  (
    await request(app)
      .get(`/api/v1/micro-ventanas?desde=${fecha}&hasta=${fecha}`)
      .set(...bearer(s))
  ).body as { data: { idVentana: number; horaInicio: string; duracionMin: number }[] };

const recalcular = (s: SesionTest, cuerpo: object = {}) =>
  request(app)
    .post('/api/v1/micro-ventanas/recalcular')
    .set(...bearer(s))
    .send(cuerpo);

const crearBloque = (s: SesionTest, horaInicio: string, horaFin: string, fecha = HOY) =>
  request(app)
    .post('/api/v1/bloques')
    .set(...bearer(s))
    .send({ tipo: 'trabajo', titulo: 'Turno', diaSemana: isoWeekday(fecha), horaInicio, horaFin });

describe('POST /micro-ventanas/recalcular', () => {
  it('sin perfil → 422 con indicación', async () => {
    const res = await recalcular(await registrar(app));
    expect(res.status).toBe(422);
    expect(res.body.detail).toBe('Configura tu perfil primero');
    expect(res.body.hint).toMatch(/POST \/perfil/);
  });

  it('crear el perfil ya genera las ventanas de la semana; recalcular de nuevo no cambia nada', async () => {
    const s = await usuarioConPerfil();
    expect((await ventanasDe(s)).data).toEqual([
      expect.objectContaining({ horaInicio: '06:15', duracionMin: 15, microPausa: null }),
    ]);
    const res = await recalcular(s);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ generadas: 0, eliminadas: 0, conservadas: 7 });
  });

  it.each([
    ['más de 31 días', { desde: HOY, hasta: sumarDias(HOY, 31) }],
    ['hasta antes que desde', { desde: HOY, hasta: sumarDias(HOY, -1) }],
    ['fecha inexistente', { desde: '2026-02-30' }],
    ['formato inválido', { desde: '19/10/2026' }],
  ])('rango inválido (%s) → 400', async (_caso, cuerpo) => {
    expect((await recalcular(await usuarioConPerfil(), cuerpo)).status).toBe(400);
  });
});

describe('recálculo automático al cambiar el horario (RNF-03)', () => {
  it('un bloque nuevo mueve las ventanas sin llamar a recalcular', async () => {
    const s = await usuarioConPerfil();
    await crearBloque(s, '06:00', '12:00');
    expect((await ventanasDe(s)).data.map((v) => v.horaInicio)).toEqual(['12:00']);

    await crearBloque(s, '11:00', '23:00');
    expect((await ventanasDe(s)).data).toEqual([]);
  });

  it('un hueco de 40 min genera una ventana de 15 y uno de 4 min ninguna', async () => {
    const s = await usuarioConPerfil();
    await crearBloque(s, '06:55', '12:00');
    await crearBloque(s, '12:04', '23:00');
    expect((await ventanasDe(s)).data).toEqual([
      expect.objectContaining({ horaInicio: '06:15', duracionMin: 15 }),
    ]);
  });
});

describe('concurrencia', () => {
  it('varios bloques creados a la vez dejan las ventanas coherentes con el horario final', async () => {
    const s = await usuarioConPerfil();
    await Promise.all([
      crearBloque(s, '06:00', '08:00'),
      crearBloque(s, '08:30', '12:00'),
      crearBloque(s, '12:30', '18:00'),
      crearBloque(s, '18:20', '23:00'),
    ]);
    // Si algún recálculo hubiera aplicado un plan obsoleto, este encontraría algo que corregir.
    const res = await recalcular(s, { desde: HOY, hasta: HOY });
    expect(res.body).toMatchObject({ generadas: 0, eliminadas: 0 });
    expect((await ventanasDe(s)).data.map((v) => v.horaInicio)).toEqual([
      '08:00',
      '12:00',
      '18:00',
    ]);
  });
});

describe('/micro-ventanas/:id', () => {
  it('detalle propio (200), ajeno (404) y descarte (204)', async () => {
    const a = await usuarioConPerfil();
    const b = await registrar(app);
    const [ventana] = (await ventanasDe(a)).data;
    const ruta = `/api/v1/micro-ventanas/${ventana!.idVentana}`;

    const propio = await request(app)
      .get(ruta)
      .set(...bearer(a));
    expect(propio.status).toBe(200);
    expect(propio.body).toMatchObject({ fecha: HOY, horaInicio: '06:15', microPausa: null });

    expect(
      (
        await request(app)
          .get(ruta)
          .set(...bearer(b))
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .delete(ruta)
          .set(...bearer(b))
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .delete(ruta)
          .set(...bearer(a))
      ).status,
    ).toBe(204);
    expect((await ventanasDe(a)).data).toEqual([]);
  });

  it('filtro conPausa=true sin pausas → lista vacía', async () => {
    const s = await usuarioConPerfil();
    const res = await request(app)
      .get('/api/v1/micro-ventanas?conPausa=true')
      .set(...bearer(s));
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(0);
  });
});
