import { PUNTOS_PAUSA, PUNTOS_SUENO_META } from '../../config/gamificacion.js';
import { conBloqueoProgreso, type Tx } from '../../common/db/bloqueos.js';
import { logger } from '../../common/logger.js';
import { hoyEnZona } from '../../common/utils/dates.js';
import {
  calcularRacha,
  insigniasMerecidas,
  maxNochesPorSemana,
  rachaVigente,
} from './gamificacion.domain.js';
import * as repo from './gamificacion.repository.js';

export interface ResultadoGamificacion {
  puntosGanados: number;
  rachaActual: number;
  insigniasNuevas: { codigo: string; nombre: string }[];
}

interface Otorgamiento {
  concepto: 'pausa' | 'sueno';
  referencia: string;
  puntos: number;
}

async function evaluarInsignias(idUsuario: number, diasActivos: number, hoy: string, tx: Tx) {
  const [catalogo, obtenidas, pausasPuntuadas, registros] = await Promise.all([
    repo.catalogoInsignias(tx),
    repo.insigniasObtenidas(idUsuario, tx),
    repo.pausasPuntuadas(idUsuario, tx),
    repo.registrosSueno(idUsuario, tx),
  ]);
  const ctx = { diasActivos, pausasPuntuadas, maxNochesSuenoSemana: maxNochesPorSemana(registros) };
  const nuevas = new Set(
    insigniasMerecidas(
      ctx,
      catalogo.map((i) => i.codigo),
      obtenidas,
    ),
  );
  const otorgadas = catalogo.filter((i) => nuevas.has(i.codigo));
  await repo.otorgarInsignias(
    idUsuario,
    otorgadas.map((i) => i.idInsignia),
    hoy,
    tx,
  );
  return otorgadas.map(({ codigo, nombre }) => ({ codigo, nombre }));
}

// §7.4: puntos (libro idempotente), racha recalculada sobre los días activos (U-7) e insignias,
// en una sola transacción con bloqueo por usuario.
function aplicar(idUsuario: number, otorgamiento?: Otorgamiento): Promise<ResultadoGamificacion> {
  return conBloqueoProgreso(idUsuario, async (tx) => {
    const hoy = hoyEnZona();
    const otorgado =
      otorgamiento !== undefined &&
      (await repo.otorgar(
        idUsuario,
        otorgamiento.concepto,
        otorgamiento.referencia,
        otorgamiento.puntos,
        tx,
      ));
    const puntosGanados = otorgado ? otorgamiento.puntos : 0;
    const dias = await repo.diasActivos(idUsuario, tx);
    const racha = calcularRacha(dias);
    await repo.guardarProgreso(idUsuario, puntosGanados, racha, tx);
    const insigniasNuevas = await evaluarInsignias(idUsuario, dias.length, hoy, tx);
    return { puntosGanados, rachaActual: rachaVigente(racha, hoy).rachaActual, insigniasNuevas };
  });
}

// Los puntos de una pausa se ligan a su ventana (clave natural fecha|horaInicio), no al id de la
// pausa: borrarla y volver a crearla en la misma ventana no vuelve a dar puntos.
export function trasCambioDePausa(
  idUsuario: number,
  ventana: { fecha: string; horaInicio: string },
  estado: 'pendiente' | 'hecha' | 'omitida',
): Promise<ResultadoGamificacion> {
  const referencia = `${ventana.fecha}|${ventana.horaInicio}`;
  return aplicar(
    idUsuario,
    estado === 'hecha' ? { concepto: 'pausa', referencia, puntos: PUNTOS_PAUSA } : undefined,
  );
}

// +5 la primera vez que una fecha cumple la meta de sueño. Si falla no se propaga: el registro
// ya se guardó y un reintento respondería 409 (los datos de gamificación son derivados).
export async function trasRegistroDeSuenoSinFallar(
  idUsuario: number,
  fecha: string,
  horas: number,
): Promise<void> {
  try {
    const meta = await repo.metaSueno(idUsuario);
    const cumple = meta !== null && horas >= meta;
    await aplicar(
      idUsuario,
      cumple ? { concepto: 'sueno', referencia: fecha, puntos: PUNTOS_SUENO_META } : undefined,
    );
  } catch (err) {
    logger.error({ err, idUsuario }, 'No se pudo aplicar la gamificación del sueño');
  }
}

// Tras borrar una micro-pausa: la racha se recalcula; los puntos no se revierten (S-09).
export async function recalcularSinFallar(idUsuario: number): Promise<void> {
  try {
    await aplicar(idUsuario);
  } catch (err) {
    logger.error({ err, idUsuario }, 'No se pudo recalcular el progreso');
  }
}
