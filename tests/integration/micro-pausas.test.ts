import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hoyEnZona, isoWeekday, sumarDias } from '../../src/common/utils/dates.js';
import {
  bearer,
  crearAdmin,
  crearAppTest,
  limpiarUsuariosDeTest,
  registrar,
  type SesionTest,
} from './helpers.js';

const app = crearAppTest();
afterAll(limpiarUsuariosDeTest);

const HOY = hoyEnZona();
const MANANA = sumarDias(HOY, 1);

interface Ventana {
  idVentana: number;
  fecha: string;
  horaInicio: string;
  duracionMin: number;
}

const enviar = (
  s: SesionTest,
  metodo: 'post' | 'patch' | 'put' | 'delete',
  ruta: string,
  cuerpo?: object,
) => {
  const cliente = request(app);
  return cliente[metodo](`/api/v1${ruta}`)
    .set(...bearer(s))
    .send(cuerpo);
};
const leer = (s: SesionTest, ruta: string) =>
  request(app)
    .get(`/api/v1${ruta}`)
    .set(...bearer(s));

// Perfil 06:15–22:45 y bloques hoy 06:30–12:00 y 12:05–23:00:
// ventanas de hoy → 06:15 (15 min) y 12:00 (5 min); mañana → 06:15 (15 min).
async function escenario(): Promise<{ s: SesionTest; v15: Ventana; v5: Ventana; manana: Ventana }> {
  const s = await registrar(app);
  await enviar(s, 'post', '/perfil', {
    horaDormir: '22:45',
    horaDespertar: '06:15',
    metaHorasSueno: 7.5,
    metaMinActividad: 150,
  });
  const dia = isoWeekday(HOY);
  const bloque = { tipo: 'trabajo', titulo: 'Turno', diaSemana: dia };
  await enviar(s, 'post', '/bloques', { ...bloque, horaInicio: '06:30', horaFin: '12:00' });
  await enviar(s, 'post', '/bloques', { ...bloque, horaInicio: '12:05', horaFin: '23:00' });
  const hoy = (await leer(s, `/micro-ventanas?desde=${HOY}&hasta=${HOY}`)).body.data as Ventana[];
  const sig = (await leer(s, `/micro-ventanas?desde=${MANANA}&hasta=${MANANA}`)).body
    .data as Ventana[];
  return {
    s,
    v15: hoy.find((v) => v.horaInicio === '06:15')!,
    v5: hoy.find((v) => v.horaInicio === '12:00')!,
    manana: sig[0]!,
  };
}

const recomendar = (s: SesionTest, v: Ventana, cuerpo: object = {}) =>
  enviar(s, 'post', `/micro-ventanas/${v.idVentana}/micro-pausa`, cuerpo);

let actividad10: number;
beforeAll(async () => {
  const s = await registrar(app);
  const res = await leer(s, '/actividades?pageSize=100');
  actividad10 = (res.body.data as { idActividad: number; duracionMin: number }[]).find(
    (a) => a.duracionMin === 10,
  )!.idActividad;
});

describe('POST /micro-ventanas/:id/micro-pausa (recomendación)', () => {
  it('asigna una actividad que cabe (201 + Location); una segunda vez → 409', async () => {
    const { s, v15 } = await escenario();
    expect(v15.duracionMin).toBe(15);
    const res = await recomendar(s, v15);
    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/v1/micro-pausas/${res.body.idPausa}`);
    expect(res.body).toMatchObject({ estado: 'pendiente', fechaRegistro: null });
    expect(res.body.actividad.duracionMin).toBeLessThanOrEqual(15);
    expect(res.body.ventana).toMatchObject({ idVentana: v15.idVentana, fecha: HOY });
    expect((await recomendar(s, v15)).status).toBe(409);
  });

  it('ventana de 5 min: elige una de ≤ 5; forzar una de 10 → 422; actividad inexistente → 404', async () => {
    const { s, v5 } = await escenario();
    expect(v5.duracionMin).toBe(5);
    expect((await recomendar(s, v5, { idActividad: actividad10 })).status).toBe(422);
    expect((await recomendar(s, v5, { idActividad: 2147483647 })).status).toBe(404);
    const res = await recomendar(s, v5);
    expect(res.status).toBe(201);
    expect(res.body.actividad.duracionMin).toBeLessThanOrEqual(5);
  });

  it('forzar una actividad que cabe la usa', async () => {
    const { s, v15 } = await escenario();
    const res = await recomendar(s, v15, { idActividad: actividad10 });
    expect(res.status).toBe(201);
    expect(res.body.actividad.idActividad).toBe(actividad10);
  });
});

describe('consulta y cumplimiento', () => {
  it('GET /micro-pausas/hoy: las de hoy ordenadas por hora', async () => {
    const { s, v15, v5, manana } = await escenario();
    await recomendar(s, v5);
    await recomendar(s, v15);
    await recomendar(s, manana);
    const res = await leer(s, '/micro-pausas/hoy');
    expect(res.status).toBe(200);
    expect((res.body as { ventana: Ventana }[]).map((p) => p.ventana.horaInicio)).toEqual([
      '06:15',
      '12:00',
    ]);
  });

  it('PATCH estado hecha (1 llamada) fija fechaRegistro; día futuro: hecha → 422, omitida → 200', async () => {
    const { s, v15, manana } = await escenario();
    const hoy = (await recomendar(s, v15)).body as { idPausa: number };
    const res = await enviar(s, 'patch', `/micro-pausas/${hoy.idPausa}`, { estado: 'hecha' });
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('hecha');
    expect(new Date(res.body.fechaRegistro as string).toISOString()).toBe(res.body.fechaRegistro);

    const futura = (await recomendar(s, manana)).body as { idPausa: number };
    const ruta = `/micro-pausas/${futura.idPausa}`;
    expect((await enviar(s, 'patch', ruta, { estado: 'hecha' })).status).toBe(422);
    expect((await enviar(s, 'patch', ruta, { estado: 'omitida' })).status).toBe(200);
    expect((await enviar(s, 'patch', ruta, { estado: 'cancelada' })).status).toBe(400);
  });

  it('PUT cambia la actividad solo si está pendiente', async () => {
    const { s, v15 } = await escenario();
    const pausa = (await recomendar(s, v15)).body as { idPausa: number };
    const ruta = `/micro-pausas/${pausa.idPausa}`;
    const res = await enviar(s, 'put', ruta, { idActividad: actividad10 });
    expect(res.status).toBe(200);
    expect(res.body.actividad.idActividad).toBe(actividad10);
    await enviar(s, 'patch', ruta, { estado: 'hecha' });
    expect((await enviar(s, 'put', ruta, { idActividad: actividad10 })).status).toBe(422);
  });

  it('el historial (hecha) sobrevive al recálculo; una pendiente tapada desaparece', async () => {
    const { s, v15, v5 } = await escenario();
    const hecha = (await recomendar(s, v15)).body as { idPausa: number };
    await enviar(s, 'patch', `/micro-pausas/${hecha.idPausa}`, { estado: 'hecha' });
    const pendiente = (await recomendar(s, v5)).body as { idPausa: number };

    // Un bloque nuevo que tapa ambas ventanas dispara el recálculo automático.
    await enviar(s, 'post', '/bloques', {
      tipo: 'estudio',
      titulo: 'Todo el día',
      diaSemana: isoWeekday(HOY),
      horaInicio: '06:00',
      horaFin: '23:30',
    });
    expect((await leer(s, `/micro-pausas/${hecha.idPausa}`)).status).toBe(200);
    expect((await leer(s, `/micro-pausas/${pendiente.idPausa}`)).status).toBe(404);
  });

  it('DELETE elimina (204) y una actividad con micro-pausas no se puede borrar (409)', async () => {
    const { s, v15 } = await escenario();
    const pausa = (await recomendar(s, v15, { idActividad: actividad10 })).body as {
      idPausa: number;
    };
    const admin = await crearAdmin(app);
    expect((await enviar(admin, 'delete', `/actividades/${actividad10}`)).status).toBe(409);
    expect((await enviar(s, 'delete', `/micro-pausas/${pausa.idPausa}`)).status).toBe(204);
  });

  it('otro usuario recibe 404 en todas las operaciones', async () => {
    const { s, v15 } = await escenario();
    const otro = await registrar(app);
    const pausa = (await recomendar(s, v15)).body as { idPausa: number };
    const ruta = `/micro-pausas/${pausa.idPausa}`;
    const respuestas = await Promise.all([
      leer(otro, ruta),
      enviar(otro, 'patch', ruta, { estado: 'hecha' }),
      enviar(otro, 'put', ruta, { idActividad: actividad10 }),
      enviar(otro, 'delete', ruta),
      recomendar(otro, v15),
    ]);
    expect(respuestas.map((r) => r.status)).toEqual([404, 404, 404, 404, 404]);
    expect((await leer(s, ruta)).body.estado).toBe('pendiente');
  });

  it('GET /micro-pausas filtra por estado', async () => {
    const { s, v15, v5 } = await escenario();
    const hecha = (await recomendar(s, v15)).body as { idPausa: number };
    await recomendar(s, v5);
    await enviar(s, 'patch', `/micro-pausas/${hecha.idPausa}`, { estado: 'hecha' });
    const res = await leer(s, '/micro-pausas?estado=hecha');
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0].idPausa).toBe(hecha.idPausa);
  });
});
