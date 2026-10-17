import type { Request, Response } from 'express';
import type { Estado, FiltrosPausas } from './micro-pausas.schemas.js';
import * as servicio from './micro-pausas.service.js';

// requireAuth garantiza req.usuario; validate garantiza params y body.
const idUsuario = (req: Request) => req.usuario!.idUsuario;
const idPausa = (req: Request) => (req.valid.params as { id: number }).id;

export async function recomendar(req: Request, res: Response): Promise<void> {
  const { idVentana } = req.valid.params as { idVentana: number };
  const { idActividad } = req.valid.body as { idActividad?: number };
  const pausa = await servicio.recomendar(idUsuario(req), idVentana, idActividad);
  res.status(201).location(`/api/v1/micro-pausas/${pausa.idPausa}`).json(pausa);
}

export async function listar(req: Request, res: Response): Promise<void> {
  res.json(await servicio.listar(idUsuario(req), req.valid.query as FiltrosPausas));
}

export async function hoy(req: Request, res: Response): Promise<void> {
  res.json(await servicio.hoy(idUsuario(req)));
}

export async function obtener(req: Request, res: Response): Promise<void> {
  res.json(await servicio.obtener(idUsuario(req), idPausa(req)));
}

export async function cambiarEstado(req: Request, res: Response): Promise<void> {
  const { estado } = req.valid.body as { estado: Estado };
  res.json(await servicio.cambiarEstado(idUsuario(req), idPausa(req), estado));
}

export async function cambiarActividad(req: Request, res: Response): Promise<void> {
  const { idActividad } = req.valid.body as { idActividad: number };
  res.json(await servicio.cambiarActividad(idUsuario(req), idPausa(req), idActividad));
}

export async function eliminar(req: Request, res: Response): Promise<void> {
  await servicio.eliminar(idUsuario(req), idPausa(req));
  res.status(204).end();
}
