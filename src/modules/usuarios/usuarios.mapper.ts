import type { Usuario } from '../../generated/prisma/client.js';
import type { UsuarioDto } from './usuarios.schemas.js';

// Nunca incluye contrasenaHash.
export function aDto(u: Usuario): UsuarioDto {
  return {
    idUsuario: u.idUsuario,
    nombre: u.nombre,
    correo: u.correo,
    fechaRegistro: u.fechaRegistro.toISOString(),
    aceptaDatos: u.aceptaDatos,
    rol: u.rol,
  };
}
