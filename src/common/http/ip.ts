import type { Request } from 'express';

// En Vercel, x-forwarded-for lo fija la plataforma; el primer valor es la IP del cliente.
export function ipCliente(req: Request): string {
  const reenviada = req.headers['x-forwarded-for'];
  const primera = (Array.isArray(reenviada) ? reenviada[0] : reenviada)?.split(',')[0]?.trim();
  return primera || req.socket.remoteAddress || 'desconocida';
}
