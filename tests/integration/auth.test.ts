import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/common/db/prisma.js';
import { UsuarioSchema } from '../../src/modules/usuarios/usuarios.schemas.js';
import {
  CONTRASENA,
  bearer,
  correoUnico,
  crearAppTest,
  limpiarUsuariosDeTest,
  registrar,
} from './helpers.js';

const app = crearAppTest();

afterAll(limpiarUsuariosDeTest);

function registro(cuerpo: Record<string, unknown>) {
  return request(app).post('/api/v1/auth/registro').send(cuerpo);
}

describe('POST /auth/registro', () => {
  it('crea la cuenta con progreso y 3 configuraciones, sin exponer el hash', async () => {
    const correo = correoUnico();
    const res = await registro({
      nombre: 'Ana',
      correo,
      contrasena: CONTRASENA,
      aceptaDatos: true,
    });

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe('/api/v1/usuarios/me');
    expect(UsuarioSchema.safeParse(res.body.usuario).success).toBe(true);
    expect(res.body.usuario).toMatchObject({ correo, rol: 'user', aceptaDatos: true });
    expect(typeof res.body.accessToken).toBe('string');
    expect(typeof res.body.refreshToken).toBe('string');
    expect(JSON.stringify(res.body)).not.toMatch(/contrasena/i);

    const id = res.body.usuario.idUsuario as number;
    expect(await prisma.progreso.count({ where: { idUsuario: id } })).toBe(1);
    expect(await prisma.configNotificacion.count({ where: { idUsuario: id } })).toBe(3);
  });

  it('aceptaDatos=false → 422', async () => {
    const res = await registro({
      nombre: 'Ana',
      correo: correoUnico(),
      contrasena: CONTRASENA,
      aceptaDatos: false,
    });
    expect(res.status).toBe(422);
    expect(res.body.type).toBe('https://vitalify.app/errors/regla-negocio');
  });

  it('contraseña sin número → 400 en el campo contrasena', async () => {
    const res = await registro({
      nombre: 'Ana',
      correo: correoUnico(),
      contrasena: 'solotexto',
      aceptaDatos: true,
    });
    expect(res.status).toBe(400);
    expect(res.body.errors).toContainEqual(expect.objectContaining({ campo: 'contrasena' }));
  });

  it('campo desconocido (rol) → 400', async () => {
    const res = await registro({
      nombre: 'Ana',
      correo: correoUnico(),
      contrasena: CONTRASENA,
      aceptaDatos: true,
      rol: 'admin',
    });
    expect(res.status).toBe(400);
  });

  it('correo duplicado con otra capitalización y espacios → 409', async () => {
    const { correo } = await registrar(app);
    const res = await registro({
      nombre: 'Otra',
      correo: `  ${correo.toUpperCase()} `,
      contrasena: CONTRASENA,
      aceptaDatos: true,
    });
    expect(res.status).toBe(409);
  });
});

describe('POST /auth/login', () => {
  it('acepta el correo en mayúsculas', async () => {
    const { correo } = await registrar(app);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ correo: correo.toUpperCase(), contrasena: CONTRASENA });
    expect(res.status).toBe(200);
    expect(res.body.usuario.correo).toBe(correo);
  });

  it('contraseña errónea y correo inexistente responden igual (401)', async () => {
    const { correo } = await registrar(app);
    const malaClave = await request(app)
      .post('/api/v1/auth/login')
      .send({ correo, contrasena: 'otra12345' });
    const inexistente = await request(app)
      .post('/api/v1/auth/login')
      .send({ correo: correoUnico(), contrasena: CONTRASENA });
    expect(malaClave.status).toBe(401);
    expect(inexistente.status).toBe(401);
    expect(malaClave.body).toEqual(inexistente.body);
    expect(malaClave.body.detail).toBe('Credenciales inválidas');
  });

  it('el 6º intento por minuto desde la misma IP → 429 con Retry-After', async () => {
    const appConLimite = createApp();
    const intento = () =>
      request(appConLimite)
        .post('/api/v1/auth/login')
        .send({ correo: correoUnico(), contrasena: CONTRASENA });
    for (let i = 0; i < 5; i++) {
      expect((await intento()).status).toBe(401);
    }
    const bloqueado = await intento();
    expect(bloqueado.status).toBe(429);
    expect(Number(bloqueado.headers['retry-after'])).toBeGreaterThan(0);
  });
});

describe('POST /auth/refresh', () => {
  function refrescar(refreshToken: string) {
    return request(app).post('/api/v1/auth/refresh').send({ refreshToken });
  }

  it('rota el refresh token', async () => {
    const sesion = await registrar(app);
    const res = await refrescar(sesion.refreshToken);
    expect(res.status).toBe(200);
    expect(res.body.refreshToken).not.toBe(sesion.refreshToken);
    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it('reutilizar un refresh ya rotado → 401 y revoca todas las sesiones', async () => {
    const sesion = await registrar(app);
    const rotado = await refrescar(sesion.refreshToken);
    expect(rotado.status).toBe(200);

    expect((await refrescar(sesion.refreshToken)).status).toBe(401);
    expect((await refrescar(rotado.body.refreshToken as string)).status).toBe(401);
  });

  it('dos rotaciones simultáneas del mismo token: nunca dos sesiones nuevas', async () => {
    const sesion = await registrar(app);
    const respuestas = await Promise.all([
      refrescar(sesion.refreshToken),
      refrescar(sesion.refreshToken),
    ]);
    const exitosas = respuestas.filter((r) => r.status === 200);
    expect(exitosas.length).toBeLessThanOrEqual(1);
    expect(respuestas.every((r) => r.status === 200 || r.status === 401)).toBe(true);
  });

  it('token basura → 401', async () => {
    expect((await refrescar('x.y.z')).status).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('revoca el refresh token (204) y luego no sirve', async () => {
    const sesion = await registrar(app);
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set(...bearer(sesion))
      .send({ refreshToken: sesion.refreshToken });
    expect(res.status).toBe(204);
    const despues = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: sesion.refreshToken });
    expect(despues.status).toBe(401);
  });

  it('sin bearer → 401', async () => {
    const res = await request(app).post('/api/v1/auth/logout').send({ refreshToken: 'a' });
    expect(res.status).toBe(401);
  });
});
