import { errores } from '../../common/errors/app-error.js';
import { hashContrasena, verificarContrasena } from '../../common/security/passwords.js';
import * as usuarios from '../usuarios/usuarios.service.js';
import type { UsuarioDto } from '../usuarios/usuarios.schemas.js';
import type { Login, Registro, Sesion } from './auth.schemas.js';
import * as sesiones from './sesiones.service.js';

async function abrirSesion(usuario: UsuarioDto): Promise<Sesion> {
  const tokens = await sesiones.emitirTokens(usuario.idUsuario, usuario.rol);
  return { usuario, ...tokens };
}

export async function registrar(datos: Registro): Promise<Sesion> {
  if (!datos.aceptaDatos) {
    throw errores.reglaNegocio(
      'Debes aceptar el tratamiento de datos personales (Ley 1581 de 2012)',
      'Envía aceptaDatos: true',
    );
  }
  const usuario = await usuarios.crearConDefaults({
    nombre: datos.nombre,
    correo: datos.correo,
    contrasenaHash: await hashContrasena(datos.contrasena),
    aceptaDatos: true,
  });
  return abrirSesion(usuario);
}

// Mismo mensaje y mismo coste (bcrypt) exista o no el correo: no se revela qué cuentas existen.
export async function login(datos: Login): Promise<Sesion> {
  const credenciales = await usuarios.buscarCredenciales(datos.correo);
  const valida = await verificarContrasena(datos.contrasena, credenciales?.contrasenaHash ?? null);
  if (!credenciales || !valida) throw errores.noAutenticado('Credenciales inválidas');
  return abrirSesion(credenciales.usuario);
}

export async function refrescar(refreshToken: string): Promise<Sesion> {
  const idUsuario = await sesiones.consumirRefresh(refreshToken);
  return abrirSesion(await usuarios.obtener(idUsuario));
}

export function logout(idUsuario: number, refreshToken: string): Promise<void> {
  return sesiones.cerrarSesion(idUsuario, refreshToken);
}
