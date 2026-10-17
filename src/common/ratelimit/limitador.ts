import { env } from '../../config/env.js';
import { crearLimitadorMemoria } from './memoria.js';
import { crearLimitadorUpstash } from './upstash.js';

export interface ResultadoLimite {
  permitido: boolean;
  restantes: number;
  reinicioMs: number;
}

export interface Limitador {
  consumir(clave: string): Promise<ResultadoLimite>;
}

export interface ReglaLimite {
  nombre: string;
  limite: number;
  ventanaSeg: number;
}

export type FabricaLimitador = (regla: ReglaLimite) => Limitador;

export const REGLAS = {
  global: { nombre: 'global', limite: 100, ventanaSeg: 60 },
  login: { nombre: 'login', limite: 5, ventanaSeg: 60 },
  auth: { nombre: 'auth', limite: 10, ventanaSeg: 60 },
} as const satisfies Record<string, ReglaLimite>;

// Upstash si hay credenciales (obligatorias en preview/production, ver env.ts); memoria en local/test.
export function fabricaPorDefecto(): FabricaLimitador {
  const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } = env;
  if (url && token) {
    return (regla) => crearLimitadorUpstash(regla, url, token);
  }
  return (regla) => crearLimitadorMemoria(regla);
}
