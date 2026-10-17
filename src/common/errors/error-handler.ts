import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '../logger.js';
import { AppError, TIPO_ERROR_BASE, errores } from './app-error.js';
import { erroresDeZod } from './zod-errors.js';

const ENTORNOS_CON_DETALLE = new Set(['local', 'test']);

interface ErrorBodyParser {
  type?: unknown;
}

function deBodyParser(err: unknown): AppError | undefined {
  const tipo = (err as ErrorBodyParser | null)?.type;
  if (tipo === 'entity.parse.failed') {
    return new AppError(400, 'json-invalido', 'JSON inválido', {
      detail: 'El cuerpo de la petición no es JSON válido',
    });
  }
  if (tipo === 'entity.too.large') {
    return new AppError(413, 'payload-demasiado-grande', 'Cuerpo demasiado grande');
  }
  return undefined;
}

function interno(err: unknown): AppError {
  const conDetalle = ENTORNOS_CON_DETALLE.has(process.env.APP_ENV ?? '');
  const detail = conDetalle && err instanceof Error ? err.message : undefined;
  return new AppError(500, 'interno', 'Error interno', { detail });
}

function normalizar(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) return errores.validacion(erroresDeZod(err));
  return deBodyParser(err) ?? interno(err);
}

function enviarProblema(res: Response, error: AppError): void {
  res
    .status(error.status)
    .type('application/problem+json')
    .json({
      type: `${TIPO_ERROR_BASE}${error.slug}`,
      title: error.title,
      status: error.status,
      ...(error.detail === undefined ? {} : { detail: error.detail }),
      ...(error.errors === undefined ? {} : { errors: error.errors }),
      ...(error.hint === undefined ? {} : { hint: error.hint }),
    });
}

export const notFoundHandler: RequestHandler = () => {
  throw errores.noEncontrado('Ruta no encontrada');
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const error = normalizar(err);
  if (error.status >= 500) {
    logger.error({ err }, 'Error no controlado');
  }
  enviarProblema(res, error);
};
