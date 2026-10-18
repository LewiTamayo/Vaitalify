import * as idempotencia from '../../common/idempotency/idempotency.repository.js';
import { VIGENCIA_MS } from '../../common/middleware/idempotency.js';
import { logger } from '../../common/logger.js';
import { hoyEnZona } from '../../common/utils/dates.js';
import { limpiarSesionesCaducadas } from '../auth/sesiones.service.js';
import { generar } from '../recordatorios/recordatorios.service.js';
import * as repo from './jobs.repository.js';

const LOTE = 100;

async function generarLote(ids: number[], fecha: string) {
  let generados = 0;
  let fallidos = 0;
  for (const idUsuario of ids) {
    try {
      generados += (await generar(idUsuario, fecha)).generados;
    } catch (err) {
      // Un usuario con un problema no detiene el job de los demás.
      fallidos += 1;
      logger.error({ err, idUsuario }, 'Fallo al generar recordatorios en el job');
    }
  }
  return { generados, fallidos };
}

// Cron diario (§7.7.1): idempotente y por lotes de 100 usuarios con perfil.
export async function generarRecordatoriosDeHoy() {
  const fecha = hoyEnZona();
  const total = { fecha, usuarios: 0, generados: 0, fallidos: 0 };
  let ids = await repo.usuariosConPerfil(0, LOTE);
  while (ids.length > 0) {
    const lote = await generarLote(ids, fecha);
    total.usuarios += ids.length;
    total.generados += lote.generados;
    total.fallidos += lote.fallidos;
    ids = await repo.usuariosConPerfil(ids.at(-1)!, LOTE);
  }
  return total;
}

export async function limpiar() {
  const [claves, refreshTokens] = await Promise.all([
    idempotencia.borrarAntiguas(new Date(Date.now() - VIGENCIA_MS)),
    limpiarSesionesCaducadas(),
  ]);
  return { idempotencia: claves, refreshTokens };
}
