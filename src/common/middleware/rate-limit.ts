import type { Request, RequestHandler } from 'express';
import { env } from '../../config/env.js';
import { AppError } from '../errors/app-error.js';
import type { Limitador } from '../ratelimit/limitador.js';

export function rateLimit(
  limitador: Limitador,
  clave: (req: Request) => string | Promise<string>,
): RequestHandler {
  return async (req, res, next) => {
    if (!env.RATE_LIMIT_ENABLED) {
      next();
      return;
    }
    const resultado = await limitador.consumir(await clave(req));
    if (resultado.permitido) {
      next();
      return;
    }
    res.setHeader('Retry-After', String(Math.max(Math.ceil(resultado.reinicioMs / 1000), 1)));
    next(
      new AppError(429, 'demasiadas-peticiones', 'Demasiadas peticiones', {
        detail: 'Intenta de nuevo en unos segundos',
      }),
    );
  };
}
