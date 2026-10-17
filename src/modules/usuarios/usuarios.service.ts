import { Prisma } from '../../common/db/prisma.js';
import { errores } from '../../common/errors/app-error.js';
import type { Rol } from '../../common/security/tokens.js';
import * as repo from './usuarios.repository.js';
import type { UsuarioDto } from './usuarios.schemas.js';

type UsuarioBd = NonNullable<Awaited<ReturnType<typeof repo.buscarPorId>>>;

export function aDto(u: UsuarioBd): UsuarioDto {
  return {
    idUsuario: u.idUsuario,
    nombre: u.nombre,
    correo: u.correo,
    fechaRegistro: u.fechaRegistro.toISOString(),
    aceptaDatos: u.aceptaDatos,
    rol: u.rol,
  };
}

const correoDuplicado = () => errores.conflicto('Ya existe una cuenta con ese correo');

function esUnicoViolado(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
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

// Un access token sigue siendo válido hasta 15 min después de eliminar la cuenta: se responde 401.
export async function obtener(idUsuario: number): Promise<UsuarioDto> {
  const u = await repo.buscarPorId(idUsuario);
  if (!u) throw errores.noAutenticado('La cuenta ya no existe');
  return aDto(u);
}
