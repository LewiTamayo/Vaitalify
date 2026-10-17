import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { errores, type ErrorCampo } from '../errors/app-error.js';
import { erroresDeZod } from '../errors/zod-errors.js';

export interface EsquemasValidacion {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

const PARTES = ['body', 'query', 'params'] as const;

// Valida body/query/params y deja el resultado en req.valid
// (en Express 5 req.query es de solo lectura, por eso no se reasigna).
export function validate(esquemas: EsquemasValidacion): RequestHandler {
  return (req, _res, next) => {
    const valid: Express.Request['valid'] = {};
    const errors: ErrorCampo[] = [];
    for (const parte of PARTES) {
      const esquema = esquemas[parte];
      if (!esquema) continue;
      const resultado = esquema.safeParse(req[parte] ?? {});
      if (resultado.success) {
        valid[parte] = resultado.data;
      } else {
        errors.push(...erroresDeZod(resultado.error));
      }
    }
    if (errors.length > 0) {
      next(errores.validacion(errors));
      return;
    }
    req.valid = valid;
    next();
  };
}
