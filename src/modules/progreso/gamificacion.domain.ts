import { COMODINES_SEMANA, HORAS_NOCHE_BUENA } from '../../config/gamificacion.js';
import { diasEntre, semanaIso } from '../../common/utils/dates.js';

// Gamificación tolerante (§7.4) e insignias (§7.6). Funciones puras.

export interface EstadoRacha {
  rachaActual: number;
  rachaMaxima: number;
  diasComodin: number;
  ultimaFechaActiva: string | null;
  semanaComodin: string | null;
}

const INICIAL: EstadoRacha = {
  rachaActual: 0,
  rachaMaxima: 0,
  diasComodin: COMODINES_SEMANA,
  ultimaFechaActiva: null,
  semanaComodin: null,
};

// Un día activo más. Reinicio perezoso de comodines por semana ISO (S-08): cuenta la semana
// del nuevo día activo. La racha solo se reinicia si los días perdidos superan los comodines.
function avanzar(estado: EstadoRacha, dia: string): EstadoRacha {
  const semana = semanaIso(dia);
  const comodines = semana === estado.semanaComodin ? estado.diasComodin : COMODINES_SEMANA;
  const perdidos =
    estado.ultimaFechaActiva === null ? null : diasEntre(estado.ultimaFechaActiva, dia) - 1;

  let rachaActual = 1;
  let diasComodin = comodines;
  if (perdidos === 0) {
    rachaActual = estado.rachaActual + 1;
  } else if (perdidos !== null && perdidos <= comodines) {
    diasComodin = comodines - perdidos;
    rachaActual = estado.rachaActual + 1;
  }
  return {
    rachaActual,
    rachaMaxima: Math.max(estado.rachaMaxima, rachaActual),
    diasComodin,
    ultimaFechaActiva: dia,
    semanaComodin: semana,
  };
}

// U-7: la racha se recalcula sobre todos los días activos (fecha de la ventana), así una
// sincronización tardía o desordenada da el mismo resultado que en orden.
export function calcularRacha(diasActivos: string[]): EstadoRacha {
  const dias = [...new Set(diasActivos)].sort((a, b) => a.localeCompare(b));
  return dias.reduce((estado, dia) => avanzar(estado, dia), INICIAL);
}

// Al consultar: una racha cuyo último día activo quedó más atrás de lo que cubren los comodines
// ya no está vigente (no se consumen comodines por mirar).
export function rachaVigente(
  estado: EstadoRacha,
  hoy: string,
): { rachaActual: number; comodinesRestantes: number } {
  const comodines = estado.semanaComodin === semanaIso(hoy) ? estado.diasComodin : COMODINES_SEMANA;
  if (estado.ultimaFechaActiva === null) return { rachaActual: 0, comodinesRestantes: comodines };
  const perdidos = diasEntre(estado.ultimaFechaActiva, hoy) - 1;
  return {
    rachaActual: perdidos <= comodines ? estado.rachaActual : 0,
    comodinesRestantes: comodines,
  };
}

export interface ContextoInsignias {
  diasActivos: number;
  pausasPuntuadas: number;
  maxNochesSuenoSemana: number;
}

// Una estrategia por código de insignia (S-05). Las insignias sin estrategia no se otorgan solas.
export const ESTRATEGIAS: Record<string, (c: ContextoInsignias) => boolean> = {
  PRIMERA_SEMANA: (c) => c.diasActivos >= 7,
  DIEZ_PAUSAS: (c) => c.pausasPuntuadas >= 10,
  SUENO_7H_5N: (c) => c.maxNochesSuenoSemana >= 5,
};

export function insigniasMerecidas(
  ctx: ContextoInsignias,
  codigosCatalogo: string[],
  yaObtenidas: string[],
): string[] {
  const obtenidas = new Set(yaObtenidas);
  return codigosCatalogo.filter(
    (codigo) => !obtenidas.has(codigo) && (ESTRATEGIAS[codigo]?.(ctx) ?? false),
  );
}

export function maxNochesPorSemana(
  registros: { fecha: string; horas: number }[],
  minimoHoras = HORAS_NOCHE_BUENA,
): number {
  const porSemana = new Map<string, number>();
  for (const r of registros) {
    if (r.horas < minimoHoras) continue;
    const semana = semanaIso(r.fecha);
    porSemana.set(semana, (porSemana.get(semana) ?? 0) + 1);
  }
  return Math.max(0, ...porSemana.values());
}
