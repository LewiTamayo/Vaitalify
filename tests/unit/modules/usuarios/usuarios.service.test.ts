import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../../../src/common/db/prisma.js';
import { hashContrasena } from '../../../../src/common/security/passwords.js';

const repo = vi.hoisted(() => ({
  buscarPorId: vi.fn(),
  actualizar: vi.fn(),
  eliminar: vi.fn(),
  cargarParaExportar: vi.fn(),
}));
const sesiones = vi.hoisted(() => ({ cerrarTodasLasSesiones: vi.fn() }));

vi.mock('../../../../src/modules/usuarios/usuarios.repository.js', () => repo);
vi.mock('../../../../src/modules/auth/sesiones.service.js', () => sesiones);

const servicio = await import('../../../../src/modules/usuarios/usuarios.service.js');

const usuarioBd = {
  idUsuario: 7,
  nombre: 'Ana',
  correo: 'ana@correo.com',
  fechaRegistro: new Date('2026-10-01T00:00:00Z'),
  aceptaDatos: true,
  rol: 'user',
};

function errorPrisma(code: string) {
  return new Prisma.PrismaClientKnownRequestError('x', { code, clientVersion: 'test' });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('actualizar: cambio de contraseña', () => {
  beforeEach(async () => {
    repo.buscarPorId.mockResolvedValue({
      ...usuarioBd,
      contrasenaHash: await hashContrasena('secreta123'),
    });
  });

  const cambio = { contrasena: 'nueva12345', contrasenaActual: 'secreta123' };

  it('cierra las sesiones ANTES de guardar la nueva contraseña', async () => {
    const orden: string[] = [];
    sesiones.cerrarTodasLasSesiones.mockImplementation(() => {
      orden.push('cerrar');
      return Promise.resolve();
    });
    repo.actualizar.mockImplementation(() => {
      orden.push('actualizar');
      return Promise.resolve(usuarioBd);
    });
    await servicio.actualizar(7, cambio);
    expect(orden).toEqual(['cerrar', 'actualizar']);
  });

  it('si no se pueden cerrar las sesiones, la contraseña no cambia', async () => {
    sesiones.cerrarTodasLasSesiones.mockRejectedValue(new Error('BD caída'));
    await expect(servicio.actualizar(7, cambio)).rejects.toThrow('BD caída');
    expect(repo.actualizar).not.toHaveBeenCalled();
  });

  it('contraseña actual incorrecta → 422 sin tocar sesiones ni datos', async () => {
    await expect(
      servicio.actualizar(7, { contrasena: 'nueva12345', contrasenaActual: 'otra12345' }),
    ).rejects.toMatchObject({ status: 422 });
    expect(sesiones.cerrarTodasLasSesiones).not.toHaveBeenCalled();
    expect(repo.actualizar).not.toHaveBeenCalled();
  });
});

describe('actualizar: errores de BD', () => {
  it('correo duplicado (P2002) → 409', async () => {
    repo.actualizar.mockRejectedValue(errorPrisma('P2002'));
    await expect(servicio.actualizar(7, { correo: 'otra@correo.com' })).rejects.toMatchObject({
      status: 409,
    });
  });

  it('cuenta eliminada (P2025) → 401', async () => {
    repo.actualizar.mockRejectedValue(errorPrisma('P2025'));
    await expect(servicio.actualizar(7, { nombre: 'Ana' })).rejects.toMatchObject({ status: 401 });
  });

  it('otros errores se propagan', async () => {
    repo.actualizar.mockRejectedValue(new Error('inesperado'));
    await expect(servicio.actualizar(7, { nombre: 'Ana' })).rejects.toThrow('inesperado');
  });
});

describe('cuenta inexistente', () => {
  it('eliminar → 401', async () => {
    repo.eliminar.mockResolvedValue(false);
    await expect(servicio.eliminar(7)).rejects.toMatchObject({ status: 401 });
  });

  it('exportar → 401', async () => {
    repo.cargarParaExportar.mockResolvedValue(null);
    await expect(servicio.exportar(7)).rejects.toMatchObject({ status: 401 });
  });

  it('cambiar la contraseña → 401', async () => {
    repo.buscarPorId.mockResolvedValue(null);
    await expect(
      servicio.actualizar(7, { contrasena: 'nueva12345', contrasenaActual: 'secreta123' }),
    ).rejects.toMatchObject({ status: 401 });
  });
});
