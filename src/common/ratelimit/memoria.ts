import type { Limitador, ReglaLimite } from './limitador.js';

// SOLO local/test: en serverless cada instancia tiene su propia memoria y esto no limitaría nada.
export function crearLimitadorMemoria(
  regla: ReglaLimite,
  ahora: () => number = Date.now,
): Limitador {
  const ventanaMs = regla.ventanaSeg * 1000;
  const contadores = new Map<string, { inicio: number; usados: number }>();

  return {
    consumir(clave) {
      const t = ahora();
      const actual = contadores.get(clave);
      const ventana = actual && t - actual.inicio < ventanaMs ? actual : { inicio: t, usados: 0 };
      ventana.usados += 1;
      contadores.set(clave, ventana);
      const permitido = ventana.usados <= regla.limite;
      return Promise.resolve({
        permitido,
        restantes: Math.max(regla.limite - ventana.usados, 0),
        reinicioMs: ventana.inicio + ventanaMs - t,
      });
    },
  };
}
