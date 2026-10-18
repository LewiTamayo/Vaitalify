import type { Request, Response } from 'express';
import type { DatosInsignia } from './insignias.schemas.js';
import * as servicio from './insignias.service.js';

// requireAuth garantiza req.usuario; validate garantiza params y body.
const idInsignia = (req: Request) => (req.valid.params as { id: number }).id;

export async function catalogo(req: Request, res: Response): Promise<void> {
  res.json(await servicio.catalogo(req.usuario!.idUsuario));
}

export async function propias(req: Request, res: Response): Promise<void> {
  res.json(await servicio.propias(req.usuario!.idUsuario));
}

export async function crear(req: Request, res: Response): Promise<void> {
  const insignia = await servicio.crear(req.valid.body as DatosInsignia);
  res.status(201).location(`/api/v1/insignias/${insignia.idInsignia}`).json(insignia);
}

export async function reemplazar(req: Request, res: Response): Promise<void> {
  res.json(await servicio.reemplazar(idInsignia(req), req.valid.body as DatosInsignia));
}

export async function eliminar(req: Request, res: Response): Promise<void> {
  await servicio.eliminar(idInsignia(req));
  res.status(204).end();
}
