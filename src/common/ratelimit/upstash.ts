import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { Limitador, ReglaLimite } from './limitador.js';

// Store compartido entre instancias de Vercel (stateless): Upstash Redis por REST.
export function crearLimitadorUpstash(regla: ReglaLimite, url: string, token: string): Limitador {
  const ratelimit = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(regla.limite, `${regla.ventanaSeg} s`),
    prefix: `vitalify:${regla.nombre}`,
  });
  return {
    async consumir(clave) {
      const { success, remaining, reset } = await ratelimit.limit(clave);
      return {
        permitido: success,
        restantes: remaining,
        reinicioMs: Math.max(reset - Date.now(), 0),
      };
    },
  };
}
