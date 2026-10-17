import type { Request, RequestHandler } from 'express';
import { env } from '../../config/env.js';
import { AppError } from '../errors/app-error.js';
import { logger } from '../logger.js';
import type { Limitador, ResultadoLimite } from '../ratelimit/limitador.js';

export interface OpcionesRateLimit {
  // Qué hacer si el store (Upstash) no responde: el límite global deja pasar el tráfico para no
  // tumbar toda la API; los límites de autenticación rechazan (503) para no abrir la fuerza bruta.
  siFalla?: 'permitir' | 'rechazar';
}

const noDisponible = () =>
  new AppError(503, 'servicio-no-disponible', 'Servicio no disponible', {
    detail: 'Intenta de nuevo en unos segundos',
  });

const demasiadas = () =>
  new AppError(429, 'demasiadas-peticiones', 'Demasiadas peticiones', {
    detail: 'Intenta de nuevo en unos segundos',
  });

export function rateLimit(
  limitador: Limitador,
  clave: (req: Request) => string | Promise<string>,
  { siFalla = 'rechazar' }: OpcionesRateLimit = {},
): RequestHandler {
  return async (req, res, next) => {
    if (!env.RATE_LIMIT_ENABLED) {
      next();
      return;
    }
    let resultado: ResultadoLimite;
    try {
      resultado = await limitador.consumir(await clave(req));
    } catch (err) {
      logger.warn({ err }, 'Rate limiting no disponible');
      next(siFalla === 'permitir' ? undefined : noDisponible());
      return;
    }
    if (resultado.permitido) {
      next();
      return;
    }
    res.setHeader('Retry-After', String(Math.max(Math.ceil(resultado.reinicioMs / 1000), 1)));
    next(demasiadas());
  };
}
