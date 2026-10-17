import type { Request, Response } from 'express';
import type { ActualizarUsuario } from './usuarios.schemas.js';
import * as servicio from './usuarios.service.js';

// requireAuth garantiza req.usuario.
const idDe = (req: Request) => req.usuario!.idUsuario;

export async function obtener(req: Request, res: Response): Promise<void> {
  res.json(await servicio.obtener(idDe(req)));
}

export async function actualizar(req: Request, res: Response): Promise<void> {
  res.json(await servicio.actualizar(idDe(req), req.valid.body as ActualizarUsuario));
}

export async function eliminar(req: Request, res: Response): Promise<void> {
  await servicio.eliminar(idDe(req));
  res.status(204).end();
}

export async function exportar(req: Request, res: Response): Promise<void> {
  const datos = await servicio.exportar(idDe(req));
  res.attachment('vitalify-datos.json').json(datos);
}
