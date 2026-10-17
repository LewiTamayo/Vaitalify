import type { RequestHandler } from 'express';
import { errores } from '../errors/app-error.js';

// Usar después de requireAuth.
export function requireRole(rol: 'admin'): RequestHandler {
  return (req, _res, next) => {
    next(req.usuario?.rol === rol ? undefined : errores.prohibido());
  };
}
