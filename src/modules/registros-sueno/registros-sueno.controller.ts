import type { Request, Response } from 'express';
import type { DatosRegistro, FiltrosRegistros } from './registros-sueno.schemas.js';
import * as servicio from './registros-sueno.service.js';

// requireAuth garantiza req.usuario; validate garantiza params y body.
const idUsuario = (req: Request) => req.usuario!.idUsuario;
const idRegistro = (req: Request) => (req.valid.params as { id: number }).id;

export async function crear(req: Request, res: Response): Promise<void> {
  const registro = await servicio.crear(idUsuario(req), req.valid.body as DatosRegistro);
  res.status(201).location(`/api/v1/registros-sueno/${registro.idRegistro}`).json(registro);
}

export async function listar(req: Request, res: Response): Promise<void> {
  res.json(await servicio.listar(idUsuario(req), req.valid.query as FiltrosRegistros));
}

export async function obtener(req: Request, res: Response): Promise<void> {
  res.json(await servicio.obtener(idUsuario(req), idRegistro(req)));
}

export async function reemplazar(req: Request, res: Response): Promise<void> {
  const datos = req.valid.body as DatosRegistro;
  res.json(await servicio.reemplazar(idUsuario(req), idRegistro(req), datos));
}

export async function eliminar(req: Request, res: Response): Promise<void> {
  await servicio.eliminar(idUsuario(req), idRegistro(req));
  res.status(204).end();
}
