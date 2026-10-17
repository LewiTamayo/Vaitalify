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

function bloque(i: number) {
  return {
    tipo: 'trabajo',
    titulo: `Bloque ${i}`.padEnd(80, '.'),
    diaSemana: (i % 7) + 1,
    horaInicio: '08:00',
    horaFin: '09:00',
  };
}

const lote = (n: number) => Array.from({ length: n }, (_, i) => bloque(i));

const importar = (s: SesionTest, bloques: unknown[]) =>
  request(app)
    .post('/api/v1/bloques/importar')
    .set(...bearer(s))
    .send({ bloques });

const totalBloques = async (s: SesionTest) =>
  (
    await request(app)
      .get('/api/v1/bloques')
      .set(...bearer(s))
  ).body.meta.total as number;

describe('POST /bloques/importar', () => {
  it('importa el lote (201) con origen importado', async () => {
    const s = await registrar(app);
    const res = await importar(s, lote(3));
    expect(res.status).toBe(201);
    expect(res.body.importados).toBe(3);
    const origenes = (res.body.bloques as { origen: string }[]).map((b) => b.origen);
    expect(new Set(origenes)).toEqual(new Set(['importado']));
    expect(await totalBloques(s)).toBe(3);
  });

  it('acepta 200 bloques y rechaza 201 o un lote vacío', async () => {
    const s = await registrar(app);
    expect((await importar(s, lote(200))).status).toBe(201);
    expect((await importar(s, lote(201))).status).toBe(400);
    expect((await importar(s, [])).status).toBe(400);
  });

  it('un bloque inválido en la posición 150 → 400 y no se guarda ninguno', async () => {
    const s = await registrar(app);
    const bloques = lote(200);
    bloques[149] = { ...bloque(149), horaFin: '07:00' };
    const res = await importar(s, bloques);
    expect(res.status).toBe(400);
    expect(res.body.errors).toContainEqual(
      expect.objectContaining({ campo: 'bloques.149.horaFin' }),
    );
    expect(await totalBloques(s)).toBe(0);
  });

  it('esta ruta admite cuerpos de más de 100 kB; POST /bloques no', async () => {
    const s = await registrar(app);
    const relleno = 'x'.repeat(120 * 1024);
    // Un cuerpo de 120 kB pasa el parser (luego falla la validación por el campo extra → 400).
    const grande = await request(app)
      .post('/api/v1/bloques/importar')
      .set(...bearer(s))
      .send({ bloques: lote(1), relleno });
    expect(grande.status).toBe(400);

    const normal = await request(app)
      .post('/api/v1/bloques')
      .set(...bearer(s))
      .send({ ...bloque(1), relleno });
    expect(normal.status).toBe(413);
  });
});
