import * as idempotencia from '../../common/idempotency/idempotency.repository.js';
import { VIGENCIA_MS } from '../../common/middleware/idempotency.js';
import { logger } from '../../common/logger.js';
import { diaLogico } from '../../common/utils/dates.js';
import { limpiarSesionesCaducadas } from '../auth/sesiones.service.js';
import { generar } from '../recordatorios/recordatorios.service.js';
import * as repo from './jobs.repository.js';

const LOTE = 100;
// Usuarios procesados a la vez dentro de un lote: acota las conexiones abiertas al pool de la BD.
const CONCURRENCIA = 5;

async function generarLote(ids: number[], fecha: string) {
  let generados = 0;
  let fallidos = 0;
  for (let i = 0; i < ids.length; i += CONCURRENCIA) {
    const grupo = ids.slice(i, i + CONCURRENCIA);
    const resultados = await Promise.allSettled(grupo.map((id) => generar(id, fecha)));
    resultados.forEach((r, j) => {
      if (r.status === 'fulfilled') {
        generados += r.value.generados;
        return;
      }
      // Un usuario con un problema no detiene el job de los demás.
      fallidos += 1;
      logger.error({ err: r.reason, idUsuario: grupo[j] }, 'Fallo al generar recordatorios');
    });
  }
  return { generados, fallidos };
}

// Cron diario (§7.7.1): idempotente y por lotes de 100 usuarios con perfil.
export async function generarRecordatoriosDeHoy() {
  // El cron corre a las 04:00 de Bogotá: el día lógico ya es hoy.
  const fecha = diaLogico();
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
