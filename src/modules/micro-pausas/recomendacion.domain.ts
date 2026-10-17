import type { Rng } from '../../common/utils/random.js';

// Recomendación de micro-pausa (§7.2). Función pura.
export interface Candidata {
  idActividad: number;
  duracionMin: number;
}

export function recomendarActividad(
  candidatas: Candidata[],
  duracionVentana: number,
  idUltimaActividad: number | null,
  rng: Rng,
): number | null {
  // 1. Solo las que caben en la ventana.
  const caben = candidatas.filter((c) => c.duracionMin <= duracionVentana);
  // 3. Variedad: se excluye la última actividad usada si queda alguna otra.
  const sinRepetir = caben.filter((c) => c.idActividad !== idUltimaActividad);
  const opciones = sinRepetir.length > 0 ? sinRepetir : caben;
  if (opciones.length === 0) return null;

  // 2. La que mejor aprovecha el tiempo (menor holgura); 4. desempate aleatorio con semilla.
  const holgura = (c: Candidata) => duracionVentana - c.duracionMin;
  const mejor = Math.min(...opciones.map(holgura));
  const empatadas = opciones.filter((c) => holgura(c) === mejor);
  return empatadas[Math.floor(rng() * empatadas.length)]!.idActividad;
}
