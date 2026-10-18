import { aMinutos } from '../../common/utils/time.js';

// Algoritmo de detección de micro-ventanas (§7.1) y reconciliación con las existentes.
// Funciones puras: minutos desde medianoche, sin BD.

export interface Intervalo {
  inicio: number;
  fin: number; // exclusivo
}

const MINUTOS_DIA = 1440;
export const MIN_VENTANA = 5;
export const MAX_VENTANA = 15;

export function diaDespierto(horaDespertar: string, horaDormir: string): Intervalo {
  const inicio = aMinutos(horaDespertar);
  const dormir = aMinutos(horaDormir);
  // Si se duerme después de medianoche, el día despierto se corta a las 24:00 (decisión MVP).
  return { inicio, fin: dormir > inicio ? dormir : MINUTOS_DIA };
}

export function fusionar(intervalos: Intervalo[]): Intervalo[] {
  const ordenados = [...intervalos].sort((a, b) => a.inicio - b.inicio);
  const resultado: Intervalo[] = [];
  for (const actual of ordenados) {
    const ultimo = resultado.at(-1);
    if (ultimo && actual.inicio <= ultimo.fin) {
      ultimo.fin = Math.max(ultimo.fin, actual.fin);
    } else {
      resultado.push({ ...actual });
    }
  }
  return resultado;
}

function recortar(bloques: Intervalo[], limite: Intervalo): Intervalo[] {
  return bloques
    .map((b) => ({ inicio: Math.max(b.inicio, limite.inicio), fin: Math.min(b.fin, limite.fin) }))
    .filter((b) => b.fin > b.inicio);
}

function huecos(ocupados: Intervalo[], limite: Intervalo): Intervalo[] {
  const libres: Intervalo[] = [];
  let cursor = limite.inicio;
  for (const ocupado of ocupados) {
    if (ocupado.inicio > cursor) libres.push({ inicio: cursor, fin: ocupado.inicio });
    cursor = Math.max(cursor, ocupado.fin);
  }
  if (limite.fin > cursor) libres.push({ inicio: cursor, fin: limite.fin });
  return libres;
}

// S-03: de cada hueco ≥ 5 min se crea UNA ventana de min(hueco, 15) al inicio del hueco.
export function detectarVentanasDia(
  bloques: Intervalo[],
  despierto: Intervalo,
): { inicio: number; duracionMin: number }[] {
  const ocupados = fusionar(recortar(bloques, despierto));
  return huecos(ocupados, despierto)
    .map((h) => ({ inicio: h.inicio, duracionMin: Math.min(h.fin - h.inicio, MAX_VENTANA) }))
    .filter((v) => v.duracionMin >= MIN_VENTANA);
}

export interface VentanaCalculada {
  fecha: string;
  horaInicio: string;
  duracionMin: number;
}

export interface VentanaExistente extends VentanaCalculada {
  idVentana: number;
  pausa: { estado: 'pendiente' | 'hecha' | 'omitida'; duracionActividad: number } | null;
}

export interface PlanReconciliacion {
  crear: VentanaCalculada[];
  eliminar: number[];
  actualizarDuracion: { idVentana: number; duracionMin: number }[];
  conservadas: number;
}

const clave = (v: VentanaCalculada) => `${v.fecha}|${v.horaInicio}`;

type Decision = { tipo: 'conservar'; nuevaDuracion?: number } | { tipo: 'eliminar' };

function decidir(existente: VentanaExistente, calculada: VentanaCalculada | undefined): Decision {
  // El historial (hecha/omitida) se conserva siempre, aunque el horario haya cambiado.
  if (existente.pausa && existente.pausa.estado !== 'pendiente') return { tipo: 'conservar' };
  if (!calculada) return { tipo: 'eliminar' };
  if (existente.pausa && existente.pausa.duracionActividad > calculada.duracionMin) {
    return { tipo: 'eliminar' };
  }
  return calculada.duracionMin === existente.duracionMin
    ? { tipo: 'conservar' }
    : { tipo: 'conservar', nuevaDuracion: calculada.duracionMin };
}

export function planificarReconciliacion(
  existentes: VentanaExistente[],
  calculadas: VentanaCalculada[],
): PlanReconciliacion {
  const porClave = new Map(calculadas.map((c) => [clave(c), c]));
  const plan: PlanReconciliacion = {
    crear: [],
    eliminar: [],
    actualizarDuracion: [],
    conservadas: 0,
  };
  const ocupadas = new Set<string>();

  for (const existente of existentes) {
    const decision = decidir(existente, porClave.get(clave(existente)));
    if (decision.tipo === 'eliminar') {
      plan.eliminar.push(existente.idVentana);
      continue;
    }
    plan.conservadas += 1;
    ocupadas.add(clave(existente));
    if (decision.nuevaDuracion !== undefined) {
      plan.actualizarDuracion.push({
        idVentana: existente.idVentana,
        duracionMin: decision.nuevaDuracion,
      });
    }
  }

  plan.crear = calculadas.filter((c) => !ocupadas.has(clave(c)));
  return plan;
}
