import { randomInt } from 'node:crypto';

// PRNG con semilla (mulberry32) para desempates de la recomendación (§7.2): los tests fijan la
// semilla y obtienen resultados deterministas. NO se usa para nada relacionado con seguridad
// (tokens, contraseñas): para eso se usa node:crypto directamente.
export type Rng = () => number;

export function crearRng(semilla: number = randomInt(2 ** 31)): Rng {
  let estado = semilla >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
