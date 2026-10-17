import type { Request, RequestHandler } from 'express';
import { errores } from '../errors/app-error.js';
import { ipCliente } from '../http/ip.js';
import { verificarAccess } from '../security/tokens.js';

const PREFIJO = 'Bearer ';

function tokenBearer(req: Request): string | undefined {
  const cabecera = req.headers.authorization;
  return cabecera?.startsWith(PREFIJO) ? cabecera.slice(PREFIJO.length).trim() : undefined;
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const token = tokenBearer(req);
  if (!token) {
    next(errores.noAutenticado('Falta el token de acceso'));
    return;
  }
  req.usuario = await verificarAccess(token);
  next();
};

// Clave del límite global: por usuario si trae un access token válido; si no, por IP.
export async function claveUsuarioOIp(req: Request): Promise<string> {
  const token = tokenBearer(req);
  if (token) {
    try {
      const { idUsuario } = await verificarAccess(token);
      return `usuario:${idUsuario}`;
    } catch {
      // Token inválido: se limita por IP; requireAuth responderá 401 si la ruta lo exige.
    }
  }
  return `ip:${ipCliente(req)}`;
}
