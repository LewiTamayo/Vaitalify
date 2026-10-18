import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/common/db/prisma.js';
import {
  bearer,
  crearAdmin,
  crearAppTest,
  limpiarUsuariosDeTest,
  registrar,
  type SesionTest,
} from './helpers.js';

const app = crearAppTest();

const creadas: number[] = [];
afterAll(async () => {
  await prisma.insignia.deleteMany({ where: { idInsignia: { in: creadas } } });
  await limpiarUsuariosDeTest();
});

const leer = (s: SesionTest, ruta: string) =>
  request(app)
    .get(`/api/v1${ruta}`)
    .set(...bearer(s));
function enviar(s: SesionTest, metodo: 'post' | 'put' | 'delete', ruta: string, cuerpo?: object) {
  const cliente = request(app);
  return cliente[metodo](`/api/v1${ruta}`)
    .set(...bearer(s))
    .send(cuerpo);
}

interface InsigniaCatalogo {
  idInsignia: number;
  codigo: string;
  obtenida: boolean;
  fechaObtencion: string | null;
}

describe('GET /insignias y /usuarios/me/insignias', () => {
  it('el catálogo indica cuáles obtuvo el usuario', async () => {
    const s = await registrar(app);
    const antes = (await leer(s, '/insignias')).body as InsigniaCatalogo[];
    expect(antes.length).toBeGreaterThanOrEqual(3);
    expect(antes.every((i) => !i.obtenida && i.fechaObtencion === null)).toBe(true);
    expect((await leer(s, '/usuarios/me/insignias')).body).toEqual([]);

    const diez = antes.find((i) => i.codigo === 'DIEZ_PAUSAS')!;
    await prisma.usuarioInsignia.create({
      data: {
        idUsuario: s.usuario.idUsuario,
        idInsignia: diez.idInsignia,
        fechaObtencion: new Date('2026-10-15'),
      },
    });

    const despues = (await leer(s, '/insignias')).body as InsigniaCatalogo[];
    expect(despues.find((i) => i.codigo === 'DIEZ_PAUSAS')).toMatchObject({
      obtenida: true,
      fechaObtencion: '2026-10-15',
    });
    const propias = (await leer(s, '/usuarios/me/insignias')).body as InsigniaCatalogo[];
    expect(propias.map((i) => i.codigo)).toEqual(['DIEZ_PAUSAS']);
  });
});

describe('administración del catálogo', () => {
  const nueva = () => ({
    codigo: `PRUEBA_${Date.now()}`,
    nombre: 'Insignia de prueba',
    descripcion: 'Solo para tests',
    criterio: 'Ninguno',
  });

  it('un usuario normal no puede crear (403)', async () => {
    expect((await enviar(await registrar(app), 'post', '/insignias', nueva())).status).toBe(403);
  });

  it('el admin crea (201), detecta códigos duplicados (409), reemplaza y elimina', async () => {
    const admin = await crearAdmin(app);
    const datos = nueva();
    const creada = await enviar(admin, 'post', '/insignias', datos);
    expect(creada.status).toBe(201);
    creadas.push(creada.body.idInsignia as number);
    expect(creada.headers.location).toBe(`/api/v1/insignias/${creada.body.idInsignia}`);
    expect((await enviar(admin, 'post', '/insignias', datos)).status).toBe(409);

    const ruta = `/insignias/${creada.body.idInsignia}`;
    const reemplazo = await enviar(admin, 'put', ruta, { ...datos, nombre: 'Otro nombre' });
    expect(reemplazo.status).toBe(200);
    expect(reemplazo.body.nombre).toBe('Otro nombre');

    expect((await enviar(admin, 'delete', ruta)).status).toBe(204);
    expect((await enviar(admin, 'delete', ruta)).status).toBe(404);
  });

  it('código con formato inválido → 400', async () => {
    const admin = await crearAdmin(app);
    expect(
      (await enviar(admin, 'post', '/insignias', { ...nueva(), codigo: 'con espacios' })).status,
    ).toBe(400);
  });
});
