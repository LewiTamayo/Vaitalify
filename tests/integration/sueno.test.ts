import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { hoyEnZona, isoWeekday, sumarDias } from '../../src/common/utils/dates.js';
import { bearer, crearAppTest, limpiarUsuariosDeTest, registrar } from './helpers.js';

const app = crearAppTest();
afterAll(limpiarUsuariosDeTest);

const HOY = hoyEnZona();
const MANANA = sumarDias(HOY, 1);
const PERFIL = {
  horaDormir: '22:45',
  horaDespertar: '06:15',
  metaHorasSueno: 7.5,
  metaMinActividad: 150,
};

describe('GET /sueno/recomendacion', () => {
  it('sin perfil → 422', async () => {
    const s = await registrar(app);
    const res = await request(app)
      .get('/api/v1/sueno/recomendacion')
      .set(...bearer(s));
    expect(res.status).toBe(422);
  });

  it('ejemplo del mockup: primera actividad mañana 07:00 → acostarse 22:45', async () => {
    const s = await registrar(app);
    await request(app)
      .post('/api/v1/perfil')
      .set(...bearer(s))
      .send({ ...PERFIL, horaDormir: '23:30' });
    await request(app)
      .post('/api/v1/bloques')
      .set(...bearer(s))
      .send({
        tipo: 'estudio',
        titulo: 'Clase',
        diaSemana: isoWeekday(MANANA),
        horaInicio: '07:00',
        horaFin: '09:00',
      });
    const res = await request(app)
      .get('/api/v1/sueno/recomendacion')
      .set(...bearer(s));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      fecha: HOY,
      horaSugeridaAcostarse: '22:45',
      horaDespertar: '06:15',
      primeraActividad: { titulo: 'Clase', horaInicio: '07:00' },
      horasDeSuenoLogradas: 7.5,
    });
    expect(res.body.checklist).toHaveLength(3);
  });

  it('sin bloques al día siguiente usa la hora de dormir del perfil', async () => {
    const s = await registrar(app);
    await request(app)
      .post('/api/v1/perfil')
      .set(...bearer(s))
      .send(PERFIL);
    const res = await request(app)
      .get(`/api/v1/sueno/recomendacion?fecha=${HOY}`)
      .set(...bearer(s));
    expect(res.body).toMatchObject({ horaSugeridaAcostarse: '22:45', primeraActividad: null });
  });

  it('fecha inválida → 400', async () => {
    const s = await registrar(app);
    const res = await request(app)
      .get('/api/v1/sueno/recomendacion?fecha=2026-02-30')
      .set(...bearer(s));
    expect(res.status).toBe(400);
  });
});
