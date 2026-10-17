import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, decodeJwt, jwtVerify } from 'jose';
import { env } from '../../config/env.js';
import { errores } from '../errors/app-error.js';

export type Rol = 'user' | 'admin';

const ALGORITMO = 'HS256';
const codificador = new TextEncoder();
const claveAccess = () => codificador.encode(env.JWT_ACCESS_SECRET);
const claveRefresh = () => codificador.encode(env.JWT_REFRESH_SECRET);

function esRol(valor: unknown): valor is Rol {
  return valor === 'user' || valor === 'admin';
}

async function verificar(token: string, clave: Uint8Array, tipo: 'access' | 'refresh') {
  try {
    const { payload } = await jwtVerify(token, clave, { algorithms: [ALGORITMO] });
    const idUsuario = Number(payload.sub);
    if (payload.typ !== tipo || !Number.isInteger(idUsuario) || idUsuario <= 0) {
      throw new Error('Token con formato inesperado');
    }
    return { payload, idUsuario };
  } catch {
    throw errores.noAutenticado('Token inválido o vencido');
  }
}

export function firmarAccess(idUsuario: number, rol: Rol): Promise<string> {
  return new SignJWT({ rol, typ: 'access' })
    .setProtectedHeader({ alg: ALGORITMO })
    .setSubject(String(idUsuario))
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_TTL)
    .sign(claveAccess());
}

export async function verificarAccess(token: string): Promise<{ idUsuario: number; rol: Rol }> {
  const { payload, idUsuario } = await verificar(token, claveAccess(), 'access');
  if (!esRol(payload.rol)) throw errores.noAutenticado('Token inválido o vencido');
  return { idUsuario, rol: payload.rol };
}

export async function firmarRefresh(idUsuario: number): Promise<{ token: string; expiraEn: Date }> {
  const token = await new SignJWT({ typ: 'refresh' })
    .setProtectedHeader({ alg: ALGORITMO })
    .setSubject(String(idUsuario))
    .setJti(randomBytes(32).toString('base64url'))
    .setIssuedAt()
    .setExpirationTime(env.JWT_REFRESH_TTL)
    .sign(claveRefresh());
  const { exp } = decodeJwt(token);
  return { token, expiraEn: new Date((exp ?? 0) * 1000) };
}

export async function verificarRefresh(token: string): Promise<{ idUsuario: number }> {
  const { idUsuario } = await verificar(token, claveRefresh(), 'refresh');
  return { idUsuario };
}

// En BD solo se guarda el hash del refresh token (si la BD se filtra, los tokens no sirven).
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
