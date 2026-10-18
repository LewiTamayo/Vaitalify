import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { env } from '../../config/env.js';
import { errores } from '../errors/app-error.js';

// Vercel Cron envía `Authorization: Bearer <CRON_SECRET>`. Se comparan los hashes SHA-256 (misma
// longitud siempre) en tiempo constante: no se filtra el secreto por tiempos ni por longitud.
const huella = (texto: string) => createHash('sha256').update(texto).digest();

export function crearCronAuth(secreto: string | undefined): RequestHandler {
  const esperada = secreto ? huella(`Bearer ${secreto}`) : null;
  return (req, _res, next) => {
    const recibida = req.headers.authorization;
    const valida =
      esperada !== null && recibida !== undefined && timingSafeEqual(huella(recibida), esperada);
    next(
      valida ? undefined : errores.noAutenticado('Solo Vercel Cron puede invocar este endpoint'),
    );
  };
}

export const cronAuth = crearCronAuth(env.CRON_SECRET);
