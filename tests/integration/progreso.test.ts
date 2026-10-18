import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { hoyEnZona, sumarDias } from '../../src/common/utils/dates.js';
import { semanaDe } from '../../src/modules/progreso/progreso.domain.js';
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

const leer = (s: SesionTest, ruta: string) =>
  request(app)
    .get(`/api/v1${ruta}`)
    .set(...bearer(s));
function enviar(s: SesionTest, metodo: 'post' | 'patch', ruta: string, cuerpo: object) {
  const cliente = request(app);
  return cliente[metodo](`/api/v1${ruta}`)
    .set(...bearer(s))
    .send(cuerpo);
}

describe('GET /progreso', () => {
  it('usuario nuevo: todo en cero y 2 comodines', async () => {
    const res = await leer(await registrar(app), '/progreso');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      puntosTotales: 0,
      rachaActual: 0,
      rachaMaxima: 0,
      diasComodin: 2,
      ultimaFechaActiva: null,
    });
  });
});

describe('GET /progreso/semanal (§7.5)', () => {
  it('resume sueño, actividad y racha de la semana actual', async () => {
    const s = await registrar(app);
    await enviar(s, 'post', '/perfil', {
      horaDormir: '22:45',
      horaDespertar: '06:15',
      metaHorasSueno: 7.5,
      metaMinActividad: 150,
    });
    const actividades = (await leer(s, '/actividades?pageSize=100')).body.data as {
      idActividad: number;
      duracionMin: number;
    }[];
    const de10 = actividades.find((a) => a.duracionMin === 10)!;
    const [ventana] = (await leer(s, `/micro-ventanas?desde=${HOY}&hasta=${HOY}`)).body.data as {
      idVentana: number;
    }[];
    const pausa = await enviar(s, 'post', `/micro-ventanas/${ventana!.idVentana}/micro-pausa`, {
      idActividad: de10.idActividad,
    });
    await enviar(s, 'patch', `/micro-pausas/${pausa.body.idPausa}`, { estado: 'hecha' });
    await enviar(s, 'post', '/registros-sueno', { fecha: HOY, horasDormidas: 7.5 });

    const res = await leer(s, '/progreso/semanal');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      semana: semanaDe(HOY),
      sueno: { promedioHoras: 7.5, metaHoras: 7.5, porDia: [{ fecha: HOY, horas: 7.5 }] },
      actividad: {
        minutosAcumulados: 10,
        metaMinutos: 150,
        porcentajeMeta: 7,
        pausasHechas: 1,
        pausasOmitidas: 0,
      },
      racha: { actual: 1, comodinesRestantes: 2 },
      insignias: [],
    });

    const progreso = (await leer(s, '/progreso')).body;
    expect(progreso).toMatchObject({ puntosTotales: 15, rachaActual: 1, ultimaFechaActiva: HOY });
  });

  it('una semana pasada sin datos: promedio null y 0 minutos', async () => {
    const s = await registrar(app);
    const res = await leer(s, `/progreso/semanal?semana=${sumarDias(HOY, -60)}`);
    expect(res.status).toBe(200);
    expect(res.body.sueno.promedioHoras).toBeNull();
    expect(res.body.actividad).toMatchObject({ minutosAcumulados: 0, metaMinutos: null });
  });

  it('fecha inválida → 400; sin token → 401', async () => {
    const s = await registrar(app);
    expect((await leer(s, '/progreso/semanal?semana=2026-02-30')).status).toBe(400);
    expect((await request(app).get('/api/v1/progreso')).status).toBe(401);
  });
});
