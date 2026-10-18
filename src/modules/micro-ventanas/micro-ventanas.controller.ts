import type { Request, Response } from 'express';
import type { FiltrosVentanas, RangoRecalculo } from './micro-ventanas.schemas.js';
import * as servicio from './micro-ventanas.service.js';

// requireAuth garantiza req.usuario; validate garantiza params.id.
const idUsuario = (req: Request) => req.usuario!.idUsuario;
const idVentana = (req: Request) => (req.valid.params as { id: number }).id;

export async function recalcular(req: Request, res: Response): Promise<void> {
  res.json(await servicio.recalcular(idUsuario(req), req.valid.body as RangoRecalculo));
}

export async function listar(req: Request, res: Response): Promise<void> {
  res.json(await servicio.listar(idUsuario(req), req.valid.query as FiltrosVentanas));
}

export async function obtener(req: Request, res: Response): Promise<void> {
  res.json(await servicio.obtener(idUsuario(req), idVentana(req)));
}

export async function eliminar(req: Request, res: Response): Promise<void> {
  await servicio.eliminar(idUsuario(req), idVentana(req));
  res.status(204).end();
}
