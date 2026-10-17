import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/common/db/prisma.js';
import { UsuarioSchema } from '../../src/modules/usuarios/usuarios.schemas.js';
import {
  CONTRASENA,
  bearer,
  crearAppTest,
  limpiarUsuariosDeTest,
  registrar,
  type SesionTest,
} from './helpers.js';

const app = crearAppTest();

afterAll(limpiarUsuariosDeTest);

function patch(sesion: SesionTest, cuerpo: Record<string, unknown>) {
  return request(app)
    .patch('/api/v1/usuarios/me')
    .set(...bearer(sesion))
    .send(cuerpo);
}

describe('GET /usuarios/me', () => {
  it('devuelve la cuenta propia sin el hash', async () => {
    const sesion = await registrar(app);
    const res = await request(app)
      .get('/api/v1/usuarios/me')
      .set(...bearer(sesion));
    expect(res.status).toBe(200);
    expect(UsuarioSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.correo).toBe(sesion.correo);
    expect(JSON.stringify(res.body)).not.toMatch(/contrasena/i);
  });

  it('sin token → 401', async () => {
    expect((await request(app).get('/api/v1/usuarios/me')).status).toBe(401);
  });
});

describe('PATCH /usuarios/me', () => {
  it('actualiza el nombre', async () => {
    const sesion = await registrar(app);
    const res = await patch(sesion, { nombre: 'Ana María' });
    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe('Ana María');
  });

  it('cuerpo vacío → 400', async () => {
    expect((await patch(await registrar(app), {})).status).toBe(400);
  });

  it('nueva contraseña sin la actual → 400 en contrasenaActual', async () => {
    const res = await patch(await registrar(app), { contrasena: 'nueva12345' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toContainEqual(expect.objectContaining({ campo: 'contrasenaActual' }));
  });

  it('contraseña actual incorrecta → 422', async () => {
    const res = await patch(await registrar(app), {
      contrasena: 'nueva12345',
      contrasenaActual: 'equivocada1',
    });
    expect(res.status).toBe(422);
  });

  it('cambiar la contraseña permite el login nuevo y cierra las sesiones previas', async () => {
    const sesion = await registrar(app);
    const res = await patch(sesion, { contrasena: 'nueva12345', contrasenaActual: CONTRASENA });
    expect(res.status).toBe(200);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ correo: sesion.correo, contrasena: 'nueva12345' });
    expect(login.status).toBe(200);

    const refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: sesion.refreshToken });
    expect(refresh.status).toBe(401);
  });

  it('correo de otra cuenta → 409', async () => {
    const otra = await registrar(app);
    const res = await patch(await registrar(app), { correo: otra.correo });
    expect(res.status).toBe(409);
  });
});

describe('GET /usuarios/me/exportar', () => {
  it('descarga todos los datos propios como adjunto JSON', async () => {
    const sesion = await registrar(app);
    const res = await request(app)
      .get('/api/v1/usuarios/me/exportar')
      .set(...bearer(sesion));
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(res.body.usuario.correo).toBe(sesion.correo);
    expect(res.body.progreso).toMatchObject({ puntosTotales: 0, diasComodin: 2 });
    expect(res.body.configNotificaciones).toHaveLength(3);
    expect(JSON.stringify(res.body)).not.toMatch(/contrasenaHash|tokenHash/);
  });
});

describe('DELETE /usuarios/me', () => {
  it('elimina la cuenta y todos sus datos; el access token deja de servir', async () => {
    const sesion = await registrar(app);
    const id = sesion.usuario.idUsuario;
    const res = await request(app)
      .delete('/api/v1/usuarios/me')
      .set(...bearer(sesion));
    expect(res.status).toBe(204);

    const despues = await request(app)
      .get('/api/v1/usuarios/me')
      .set(...bearer(sesion));
    expect(despues.status).toBe(401);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ correo: sesion.correo, contrasena: CONTRASENA });
    expect(login.status).toBe(401);

    expect(await prisma.progreso.count({ where: { idUsuario: id } })).toBe(0);
    expect(await prisma.configNotificacion.count({ where: { idUsuario: id } })).toBe(0);
    expect(await prisma.refreshToken.count({ where: { idUsuario: id } })).toBe(0);
  });
});
