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

interface Recordatorio {
  idRecordatorio: number;
  tipo: 'sueno' | 'pausa';
  mensaje: string;
  fechaHoraEnvio: string;
  enviado: boolean;
}

const leer = (s: SesionTest, ruta: string) =>
  request(app)
    .get(`/api/v1${ruta}`)
    .set(...bearer(s));
const enviar = (s: SesionTest, metodo: 'post' | 'put' | 'patch', ruta: string, cuerpo: object) => {
  const cliente = request(app);
  return cliente[metodo](`/api/v1${ruta}`)
    .set(...bearer(s))
    .send(cuerpo);
};

async function conPerfil(): Promise<SesionTest> {
  const s = await registrar(app);
  await enviar(s, 'post', '/perfil', {
    horaDormir: '22:45',
    horaDespertar: '06:15',
    metaHorasSueno: 7.5,
    metaMinActividad: 150,
  });
  return s;
}

const deHoy = async (s: SesionTest, tipo?: string) => {
  const filtroTipo = tipo ? `&tipo=${tipo}` : '';
  const res = await leer(s, `/recordatorios?desde=${HOY}&hasta=${HOY}${filtroTipo}`);
  return res.body.data as Recordatorio[];
};

describe('POST /recordatorios/generar', () => {
  it('es idempotente: crear el perfil ya generó los 2 de sueño; generar de nuevo no duplica', async () => {
    const s = await conPerfil();
    expect(await deHoy(s, 'sueno')).toHaveLength(2);
    const res = await enviar(s, 'post', '/recordatorios/generar', { fecha: HOY });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ generados: 0, eliminados: 0, conservados: 2 });
    expect(await deHoy(s)).toHaveLength(2);
  });

  it('sin perfil solo genera recordatorios de pausa (ninguno sin pausas)', async () => {
    const s = await registrar(app);
    const res = await enviar(s, 'post', '/recordatorios/generar', {});
    expect(res.body).toEqual({ generados: 0, eliminados: 0, conservados: 0 });
  });
});

describe('configuración y regeneración automática', () => {
  it('desactivar el sueño elimina los no enviados y conserva los ya enviados', async () => {
    const s = await conPerfil();
    const [primero] = await deHoy(s, 'sueno');
    const acuse = await enviar(s, 'patch', `/recordatorios/${primero!.idRecordatorio}`, {
      enviado: true,
    });
    expect(acuse.status).toBe(200);
    expect(acuse.body.enviado).toBe(true);

    await enviar(s, 'put', '/config-notificaciones/sueno', {
      activa: false,
      silencioInicio: null,
      silencioFin: null,
    });
    const quedan = await deHoy(s, 'sueno');
    expect(quedan.map((r) => r.idRecordatorio)).toEqual([primero!.idRecordatorio]);
  });

  it('asignar una micro-pausa hoy crea su recordatorio 5 min antes', async () => {
    const s = await conPerfil();
    const ventanas = (await leer(s, `/micro-ventanas?desde=${HOY}&hasta=${HOY}`)).body.data as {
      idVentana: number;
      horaInicio: string;
    }[];
    await enviar(s, 'post', `/micro-ventanas/${ventanas[0]!.idVentana}/micro-pausa`, {});
    const pausas = await deHoy(s, 'pausa');
    expect(pausas).toHaveLength(1);
    expect(pausas[0]!.mensaje).toMatch(/^En 5 minutos: /);
  });
});

describe('casos límite de la generación', () => {
  it('día que empieza por la tarde: generar el día siguiente no borra los recordatorios de sueño de hoy', async () => {
    const s = await conPerfil();
    const manana = sumarDias(HOY, 1);
    await enviar(s, 'post', '/bloques', {
      tipo: 'trabajo',
      titulo: 'Turno de tarde',
      diaSemana: isoWeekday(manana),
      horaInicio: '14:00',
      horaFin: '20:00',
    });
    expect(await deHoy(s, 'sueno')).toHaveLength(2);
    await enviar(s, 'post', '/recordatorios/generar', { fecha: manana });
    expect(await deHoy(s, 'sueno')).toHaveLength(2);
  });

  it('una hora editada por el usuario sobrevive a la regeneración y no se duplica', async () => {
    const s = await conPerfil();
    const [r] = await deHoy(s, 'sueno');
    const nuevaHora = new Date(new Date(r!.fechaHoraEnvio).getTime() - 15 * 60_000).toISOString();
    const editado = await enviar(s, 'patch', `/recordatorios/${r!.idRecordatorio}`, {
      fechaHoraEnvio: nuevaHora,
    });
    expect(editado.status).toBe(200);
    await enviar(s, 'post', '/recordatorios/generar', { fecha: HOY });
    const despues = await deHoy(s, 'sueno');
    expect(despues).toHaveLength(2);
    expect(despues.find((x) => x.idRecordatorio === r!.idRecordatorio)?.fechaHoraEnvio).toBe(
      nuevaHora,
    );
  });
});

describe('consulta y edición', () => {
  it('no se puede editar un recordatorio ya enviado (422)', async () => {
    const s = await conPerfil();
    const [r] = await deHoy(s, 'sueno');
    await enviar(s, 'patch', `/recordatorios/${r!.idRecordatorio}`, { enviado: true });
    const res = await enviar(s, 'patch', `/recordatorios/${r!.idRecordatorio}`, {
      mensaje: 'Otro texto',
    });
    expect(res.status).toBe(422);
  });

  it('pendientes: máx. 72 h; solo futuros, no enviados y en orden', async () => {
    const s = await conPerfil();
    expect((await leer(s, '/recordatorios/pendientes?horas=73')).status).toBe(400);
    const res = await leer(s, '/recordatorios/pendientes?horas=72');
    expect(res.status).toBe(200);
    const lista = res.body as Recordatorio[];
    const ahora = Date.now();
    for (const r of lista) {
      expect(r.enviado).toBe(false);
      expect(new Date(r.fechaHoraEnvio).getTime()).toBeGreaterThan(ahora - 60_000);
    }
    const instantes = lista.map((r) => r.fechaHoraEnvio);
    expect(instantes).toEqual(instantes.toSorted((a, b) => a.localeCompare(b)));
  });

  it('otro usuario recibe 404; DELETE propio → 204', async () => {
    const s = await conPerfil();
    const otro = await registrar(app);
    const [r] = await deHoy(s);
    const ruta = `/recordatorios/${r!.idRecordatorio}`;
    expect((await leer(otro, ruta)).status).toBe(404);
    expect((await enviar(otro, 'patch', ruta, { enviado: true })).status).toBe(404);
    const borrado = await request(app)
      .delete(`/api/v1${ruta}`)
      .set(...bearer(s));
    expect(borrado.status).toBe(204);
  });
});
