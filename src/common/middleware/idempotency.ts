import { createHash } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { esUnicoViolado } from '../db/errores-prisma.js';
import { errores } from '../errors/app-error.js';
import * as repo from '../idempotency/idempotency.repository.js';
import { logger } from '../logger.js';

// Soporte offline (RNF-09): un cliente que reintenta una petición con la misma Idempotency-Key
// recibe la respuesta guardada sin repetir efectos. Usar después de requireAuth.
//
// 1. La clave se RESERVA antes de ejecutar (insert atómico): dos peticiones idénticas
//    simultáneas no se ejecutan dos veces; la segunda recibe 409 mientras la primera sigue.
// 2. La clave queda ligada al método, la ruta y una huella del cuerpo: reutilizarla con otro
//    cuerpo u otra ruta → 422 (no se devuelve en silencio una respuesta que no corresponde).
// 3. Solo se guardan respuestas 2xx y ANTES de enviarlas (Vercel puede congelar la función tras
//    responder). Ante un error la reserva se libera para poder corregir y reintentar.

const CABECERA = 'idempotency-key';
const FORMATO = /^[\w-]{1,64}$/;
export const VIGENCIA_MS = 24 * 60 * 60 * 1000;

function firma(req: Request): string {
  const huella = createHash('sha256')
    .update(JSON.stringify(req.body ?? null))
    .digest('hex')
    .slice(0, 16);
  return `${req.method} ${req.originalUrl.split('?')[0]} #${huella}`;
}

function capturarRespuesta(res: Response, clave: string): void {
  const enviar = res.json.bind(res);
  res.json = (cuerpo: unknown) => {
    const exito = res.statusCode >= 200 && res.statusCode < 300;
    const persistir = exito ? repo.completar(clave, res.statusCode, cuerpo) : repo.liberar(clave);
    persistir
      .catch((err: unknown) => logger.warn({ err }, 'No se pudo actualizar la clave idempotente'))
      .finally(() => enviar(cuerpo));
    return res;
  };
}

type Previa = NonNullable<Awaited<ReturnType<typeof repo.buscar>>>;

function responderPrevia(previa: Previa, ruta: string, res: Response, next: NextFunction): void {
  if (previa.metodoRuta !== ruta) {
    next(errores.reglaNegocio('Idempotency-Key ya usada en otra petición'));
    return;
  }
  if (previa.codigo === repo.EN_CURSO) {
    next(errores.conflicto('La petición original con esta Idempotency-Key aún se está procesando'));
    return;
  }
  res.setHeader('Idempotent-Replayed', 'true');
  res.status(previa.codigo).json(previa.respuesta);
}

async function reservarOPrevia(clave: string, ruta: string): Promise<Previa | null> {
  await repo.borrarVencida(clave, new Date(Date.now() - VIGENCIA_MS));
  try {
    await repo.reservar(clave, ruta);
    return null;
  } catch (error) {
    if (!esUnicoViolado(error)) throw error;
    // Otra petición con la misma clave llegó primero.
    const previa = await repo.buscar(clave);
    if (!previa) throw errores.conflicto('Reintenta la petición');
    return previa;
  }
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
    const ruta = firma(req);
    const previa = await reservarOPrevia(clave, ruta);
    if (previa) {
      responderPrevia(previa, ruta, res, next);
      return;
    }
    capturarRespuesta(res, clave);
    next();
  };
}
