import { errores } from '../../common/errors/app-error.js';
import {
  firmarAccess,
  firmarRefresh,
  hashToken,
  verificarRefresh,
  type Rol,
} from '../../common/security/tokens.js';
import * as repo from './auth.repository.js';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

const sesionInvalida = () => errores.noAutenticado('Sesión inválida o vencida');

export async function emitirTokens(idUsuario: number, rol: Rol): Promise<Tokens> {
  const accessToken = await firmarAccess(idUsuario, rol);
  const { token: refreshToken, expiraEn } = await firmarRefresh(idUsuario);
  await repo.guardarRefresh(idUsuario, hashToken(refreshToken), expiraEn);
  return { accessToken, refreshToken };
}

// Valida y consume un refresh token. Si ya había sido usado (posible robo), cierra todas las sesiones.
export async function consumirRefresh(refreshToken: string): Promise<number> {
  const { idUsuario } = await verificarRefresh(refreshToken);
  const registro = await repo.buscarRefresh(hashToken(refreshToken));
  if (registro?.idUsuario !== idUsuario || registro.expiraEn.getTime() <= Date.now()) {
    throw sesionInvalida();
  }
  const consumido = !registro.revocado && (await repo.revocarRefresh(registro.idToken));
  if (!consumido) {
    await repo.revocarTodos(idUsuario);
    throw sesionInvalida();
  }
  return idUsuario;
}

export async function cerrarSesion(idUsuario: number, refreshToken: string): Promise<void> {
  const registro = await repo.buscarRefresh(hashToken(refreshToken));
  if (registro?.idUsuario === idUsuario) {
    await repo.revocarRefresh(registro.idToken);
  }
}

export function limpiarSesionesCaducadas(): Promise<number> {
  return repo.borrarCaducados(new Date());
}

export function cerrarTodasLasSesiones(idUsuario: number): Promise<void> {
  return repo.revocarTodos(idUsuario);
}
