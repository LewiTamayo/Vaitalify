import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { errores } from '../../../../src/common/errors/app-error.js';
import { errorHandler } from '../../../../src/common/errors/error-handler.js';
import { crearLimitadorMemoria } from '../../../../src/common/ratelimit/memoria.js';
import { firmarAccess } from '../../../../src/common/security/tokens.js';

vi.mock('../../../../src/modules/usuarios/usuarios.service.js', () => ({
  actualizar: () => Promise.reject(errores.reglaNegocio('La contraseña actual no es correcta')),
}));

const { crearUsuariosRouter } = await import('../../../../src/modules/usuarios/usuarios.routes.js');

function crearApp() {
  const app = express();
  app.use(express.json());
  app.use(crearUsuariosRouter((regla) => crearLimitadorMemoria(regla)));
  app.use(errorHandler);
  return app;
}

describe('PATCH /usuarios/me: intentos de contrasenaActual', () => {
  it('limita a 5 por minuto por usuario los cambios de contraseña (fuerza bruta)', async () => {
    const app = crearApp();
    const token = await firmarAccess(7, 'user');
    const intento = () =>
      request(app)
        .patch('/usuarios/me')
        .set('authorization', `Bearer ${token}`)
        .send({ contrasena: 'nueva12345', contrasenaActual: 'adivina123' });

    for (let i = 0; i < 5; i++) {
      expect((await intento()).status).toBe(422);
    }
    expect((await intento()).status).toBe(429);
  });

  it('los cambios sin contraseña no consumen ese límite', async () => {
    const app = crearApp();
    const token = await firmarAccess(8, 'user');
    for (let i = 0; i < 6; i++) {
      const res = await request(app)
        .patch('/usuarios/me')
        .set('authorization', `Bearer ${token}`)
        .send({ nombre: 'Ana' });
      expect(res.status).toBe(422);
    }
  });
});
