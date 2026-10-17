import { Prisma } from '../../common/db/prisma.js';
import { errores } from '../../common/errors/app-error.js';
import { hashContrasena, verificarContrasena } from '../../common/security/passwords.js';
import type { Rol } from '../../common/security/tokens.js';
import { cerrarTodasLasSesiones } from '../auth/sesiones.service.js';
import { construirExportacion, type ExportacionUsuario } from './usuarios.export.js';
import { aDto } from './usuarios.mapper.js';
import * as repo from './usuarios.repository.js';
import type { ActualizarUsuario, UsuarioDto } from './usuarios.schemas.js';

const correoDuplicado = () => errores.conflicto('Ya existe una cuenta con ese correo');
// Un access token sigue siendo válido hasta 15 min después de eliminar la cuenta: se responde 401.
const cuentaInexistente = () => errores.noAutenticado('La cuenta ya no existe');

function esUnicoViolado(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function esNoEncontrado(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

export async function crearConDefaults(datos: repo.NuevoUsuario): Promise<UsuarioDto> {
  try {
    return aDto(await repo.crearConDefaults(datos));
  } catch (error) {
    if (esUnicoViolado(error)) throw correoDuplicado();
    throw error;
  }
}

export interface Credenciales {
  idUsuario: number;
  rol: Rol;
  contrasenaHash: string;
  usuario: UsuarioDto;
}

export async function buscarCredenciales(correo: string): Promise<Credenciales | null> {
  const u = await repo.buscarPorCorreo(correo);
  return (
    u && { idUsuario: u.idUsuario, rol: u.rol, contrasenaHash: u.contrasenaHash, usuario: aDto(u) }
  );
}

export async function obtener(idUsuario: number): Promise<UsuarioDto> {
  const u = await repo.buscarPorId(idUsuario);
  if (!u) throw cuentaInexistente();
  return aDto(u);
}

async function nuevoHashSiCambia(idUsuario: number, cambios: ActualizarUsuario) {
  if (cambios.contrasena === undefined) return undefined;
  const actual = await repo.buscarPorId(idUsuario);
  if (!actual) throw cuentaInexistente();
  const valida = await verificarContrasena(cambios.contrasenaActual ?? '', actual.contrasenaHash);
  if (!valida) throw errores.reglaNegocio('La contraseña actual no es correcta');
  return hashContrasena(cambios.contrasena);
}

export async function actualizar(
  idUsuario: number,
  cambios: ActualizarUsuario,
): Promise<UsuarioDto> {
  const contrasenaHash = await nuevoHashSiCambia(idUsuario, cambios);
  // Cambiar la contraseña cierra todas las sesiones (p. ej., un dispositivo perdido). Se cierran
  // ANTES de guardar: si esto falla, la contraseña no cambia y no quedan sesiones viejas vivas.
  if (contrasenaHash) await cerrarTodasLasSesiones(idUsuario);
  try {
    const u = await repo.actualizar(idUsuario, {
      nombre: cambios.nombre,
      correo: cambios.correo,
      contrasenaHash,
    });
    return aDto(u);
  } catch (error) {
    if (esUnicoViolado(error)) throw correoDuplicado();
    if (esNoEncontrado(error)) throw cuentaInexistente();
    throw error;
  }
}

// Derecho de supresión: la BD borra en cascada todos los datos del usuario.
export async function eliminar(idUsuario: number): Promise<void> {
  if (!(await repo.eliminar(idUsuario))) throw cuentaInexistente();
}

export async function exportar(idUsuario: number): Promise<ExportacionUsuario> {
  const datos = await repo.cargarParaExportar(idUsuario);
  if (!datos) throw cuentaInexistente();
  return construirExportacion(datos, new Date());
}
