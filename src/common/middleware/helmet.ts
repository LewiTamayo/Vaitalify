import type { IncomingMessage, ServerResponse } from 'node:http';
import helmetImport, { type HelmetOptions } from 'helmet';

type MiddlewareHelmet = (
  req: IncomingMessage,
  res: ServerResponse,
  next: (err?: unknown) => void,
) => void;
type FuncionHelmet = (opciones?: Readonly<HelmetOptions>) => MiddlewareHelmet;

// helmet es un paquete dual (ESM + CJS). Según cómo compile la plataforma (Vercel tipa el import
// por defecto como el módulo CJS completo), llega la función o un objeto con `.default`.
export function normalizarHelmet(modulo: unknown): FuncionHelmet {
  if (typeof modulo === 'function') return modulo as FuncionHelmet;
  return (modulo as { default: FuncionHelmet }).default;
}

export const helmet: FuncionHelmet = normalizarHelmet(helmetImport);
