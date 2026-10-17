import type { Request, RequestHandler, Response } from 'express';
import { errores } from '../errors/app-error.js';
import * as repo from '../idempotency/idempotency.repository.js';
import { logger } from '../logger.js';

// Soporte offline (RNF-09): un cliente que reintenta una petición con la misma Idempotency-Key
// recibe la respuesta guardada sin repetir efectos. Usar después de requireAuth.

const CABECERA = 'idempotency-key';
const FORMATO = /^[\w-]{1,64}$/;
export const VIGENCIA_MS = 24 * 60 * 60 * 1000;

const metodoRuta = (req: Request) => `${req.method} ${req.originalUrl.split('?')[0]}`;

function responderGuardada(res: Response, codigo: number, respuesta: unknown): void {
  res.setHeader('Idempotent-Replayed', 'true');
  res.status(codigo).json(respuesta);
}

// Se guarda ANTES de enviar: en Vercel la función puede congelarse en cuanto responde.
// Solo se guardan respuestas 2xx: un error de validación se puede corregir y reintentar.
function capturarRespuesta(res: Response, clave: string, ruta: string): void {
  const enviar = res.json.bind(res);
  res.json = (cuerpo: unknown) => {
    if (res.statusCode < 200 || res.statusCode >= 300) return enviar(cuerpo);
    repo
      .guardar(clave, ruta, res.statusCode, cuerpo)
      .catch((err: unknown) => logger.warn({ err }, 'No se pudo guardar la respuesta idempotente'))
      .finally(() => enviar(cuerpo));
    return res;
  };
}

export function idempotencia(): RequestHandler {
  return async (req, res, next) => {
    const valor = req.get(CABECERA);
    if (valor === undefined) {
      next();
      return;
    }
    if (!FORMATO.test(valor)) {
      next(
        errores.validacion([
          { campo: 'Idempotency-Key', mensaje: 'Usa de 1 a 64 caracteres: letras, números, - o _' },
        ]),
      );
      return;
    }
    const clave = `${req.usuario!.idUsuario}:${valor}`;
    const ruta = metodoRuta(req);
    const previa = await repo.buscar(clave);
    const vigente = previa && Date.now() - previa.creadaEn.getTime() < VIGENCIA_MS;
    if (vigente && previa.metodoRuta !== ruta) {
      next(errores.reglaNegocio('Idempotency-Key ya usada en otra petición'));
      return;
    }
    if (vigente) {
      responderGuardada(res, previa.codigo, previa.respuesta);
      return;
    }
    capturarRespuesta(res, clave, ruta);
    next();
  };
}
