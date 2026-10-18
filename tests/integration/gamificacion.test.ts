import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/common/db/prisma.js';
import { hoyEnZona, isoWeekday, parseFecha, sumarDias } from '../../src/common/utils/dates.js';
import { parseHHmm } from '../../src/common/utils/time.js';
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

function enviar(s: SesionTest, metodo: 'post' | 'patch' | 'delete', ruta: string, cuerpo?: object) {
  const cliente = request(app);
  return cliente[metodo](`/api/v1${ruta}`)
    .set(...bearer(s))
    .send(cuerpo);
}

// Usuario con perfil (meta de sueño 7.5) y dos micro-pausas pendientes hoy (06:15 y 12:00).
async function conPausasHoy(): Promise<{ s: SesionTest; pausas: number[] }> {
  const s = await registrar(app);
  await enviar(s, 'post', '/perfil', {
    horaDormir: '22:45',
    horaDespertar: '06:15',
    metaHorasSueno: 7.5,
    metaMinActividad: 150,
  });
  await enviar(s, 'post', '/bloques', {
    tipo: 'trabajo',
    titulo: 'T',
    diaSemana: isoWeekday(HOY),
    horaInicio: '06:30',
    horaFin: '12:00',
  });
  const ventanas = (
    await request(app)
      .get(`/api/v1/micro-ventanas?desde=${HOY}&hasta=${HOY}`)
      .set(...bearer(s))
  ).body.data as { idVentana: number }[];
  const pausas: number[] = [];
  for (const v of ventanas.slice(0, 2)) {
    const res = await enviar(s, 'post', `/micro-ventanas/${v.idVentana}/micro-pausa`, {});
    pausas.push(res.body.idPausa as number);
  }
  return { s, pausas };
}

const marcar = (s: SesionTest, idPausa: number, estado: string) =>
  enviar(s, 'patch', `/micro-pausas/${idPausa}`, { estado });

const progreso = (s: SesionTest) =>
  prisma.progreso.findUniqueOrThrow({ where: { idUsuario: s.usuario.idUsuario } });

describe('puntos y racha al registrar el cumplimiento', () => {
  it('marcar hecha suma 10 puntos e inicia la racha; la respuesta lo informa', async () => {
    const { s, pausas } = await conPausasHoy();
    const res = await marcar(s, pausas[0]!, 'hecha');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      estado: 'hecha',
      puntosGanados: 10,
      rachaActual: 1,
      insigniasNuevas: [],
    });
    expect(await progreso(s)).toMatchObject({ puntosTotales: 10, rachaActual: 1 });
  });

  it('alternar hecha → pendiente → hecha no cobra dos veces', async () => {
    const { s, pausas } = await conPausasHoy();
    await marcar(s, pausas[0]!, 'hecha');
    await marcar(s, pausas[0]!, 'pendiente');
    const otra = await marcar(s, pausas[0]!, 'hecha');
    expect(otra.body.puntosGanados).toBe(0);
    expect((await progreso(s)).puntosTotales).toBe(10);
  });

  it('dos pausas del mismo día marcadas a la vez: 20 puntos y racha 1', async () => {
    const { s, pausas } = await conPausasHoy();
    const respuestas = await Promise.all(pausas.map((id) => marcar(s, id, 'hecha')));
    expect(respuestas.map((r) => r.status)).toEqual([200, 200]);
    expect(await progreso(s)).toMatchObject({ puntosTotales: 20, rachaActual: 1 });
  });

  it('borrar una pausa hecha no resta puntos (S-09)', async () => {
    const { s, pausas } = await conPausasHoy();
    await marcar(s, pausas[0]!, 'hecha');
    expect((await enviar(s, 'delete', `/micro-pausas/${pausas[0]}`)).status).toBe(204);
    expect((await progreso(s)).puntosTotales).toBe(10);
  });
});

describe('puntos por cumplir la meta de sueño', () => {
  it('+5 una sola vez por fecha, aunque se borre y se vuelva a registrar', async () => {
    const { s } = await conPausasHoy();
    const ayer = sumarDias(HOY, -1);
    const creado = await enviar(s, 'post', '/registros-sueno', { fecha: ayer, horasDormidas: 8 });
    expect((await progreso(s)).puntosTotales).toBe(5);
    await enviar(s, 'delete', `/registros-sueno/${creado.body.idRegistro}`);
    await enviar(s, 'post', '/registros-sueno', { fecha: ayer, horasDormidas: 8 });
    expect((await progreso(s)).puntosTotales).toBe(5);
    await enviar(s, 'post', '/registros-sueno', { fecha: sumarDias(HOY, -2), horasDormidas: 6 });
    expect((await progreso(s)).puntosTotales).toBe(5);
  });
});

describe('insignias', () => {
  it('la décima pausa hecha otorga DIEZ_PAUSAS (y 10 días activos PRIMERA_SEMANA) una sola vez', async () => {
    const { s, pausas } = await conPausasHoy();
    const idUsuario = s.usuario.idUsuario;
    const { idActividad } = await prisma.actividad.findFirstOrThrow({
      select: { idActividad: true },
    });
    // Historial: 9 días anteriores con una pausa hecha y sus puntos ya otorgados.
    for (let i = 1; i <= 9; i++) {
      const ventana = await prisma.microVentana.create({
        data: {
          idUsuario,
          fecha: parseFecha(sumarDias(HOY, -i)),
          horaInicio: parseHHmm('20:00'),
          duracionMin: 15,
          microPausa: { create: { idActividad, estado: 'hecha', fechaRegistro: new Date() } },
        },
        include: { microPausa: true },
      });
      await prisma.puntosOtorgados.create({
        data: {
          idUsuario,
          concepto: 'pausa',
          referencia: String(ventana.microPausa!.idPausa),
          puntos: 10,
        },
      });
    }
    const res = await marcar(s, pausas[0]!, 'hecha');
    const codigos = (res.body.insigniasNuevas as { codigo: string }[]).map((i) => i.codigo);
    expect(codigos).toEqual(expect.arrayContaining(['DIEZ_PAUSAS', 'PRIMERA_SEMANA']));
    expect(res.body.rachaActual).toBe(10);

    const otra = await marcar(s, pausas[1]!, 'hecha');
    expect(otra.body.insigniasNuevas).toEqual([]);
    expect(await prisma.usuarioInsignia.count({ where: { idUsuario } })).toBe(2);
  });
});
