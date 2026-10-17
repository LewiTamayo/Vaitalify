import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { env } from '../../config/env.js';

// bcrypt ignora en silencio lo que pasa de 72 bytes: se rechaza para que no haya colisiones.
const MAX_BYTES = 72;

export const contrasenaSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .refine((valor) => !excedeLimiteBcrypt(valor), {
    message: 'La contraseña no puede superar 72 bytes',
  })
  .refine((valor) => /\p{L}/u.test(valor), { message: 'La contraseña debe incluir una letra' })
  .refine((valor) => /\d/.test(valor), { message: 'La contraseña debe incluir un número' });

export function excedeLimiteBcrypt(plana: string): boolean {
  return Buffer.byteLength(plana, 'utf8') > MAX_BYTES;
}

let hashFicticio: Promise<string> | undefined;

export function hashContrasena(plana: string): Promise<string> {
  return bcrypt.hash(plana, env.BCRYPT_COST);
}

// Con hash nulo (usuario inexistente) o contraseña de más de 72 bytes (bcrypt solo compararía
// los primeros 72) se compara contra un hash ficticio del mismo coste y se devuelve false:
// el tiempo de respuesta no revela si el correo está registrado.
export async function verificarContrasena(plana: string, hash: string | null): Promise<boolean> {
  if (hash === null || excedeLimiteBcrypt(plana)) {
    hashFicticio ??= hashContrasena('contrasena-ficticia-1');
    await bcrypt.compare(plana, await hashFicticio);
    return false;
  }
  return bcrypt.compare(plana, hash);
}
