import type { Request, Response } from 'express';
import type { DatosBloque, DatosBloqueParcial, FiltrosBloques } from './bloques.schemas.js';
import * as servicio from './bloques.service.js';

// requireAuth garantiza req.usuario; validate garantiza params.id.
const idUsuario = (req: Request) => req.usuario!.idUsuario;
const idBloque = (req: Request) => (req.valid.params as { id: number }).id;

export async function crear(req: Request, res: Response): Promise<void> {
  const bloque = await servicio.crear(idUsuario(req), req.valid.body as DatosBloque);
  res.status(201).location(`/api/v1/bloques/${bloque.idBloque}`).json(bloque);
}

export async function listar(req: Request, res: Response): Promise<void> {
  res.json(await servicio.listar(idUsuario(req), req.valid.query as FiltrosBloques));
}

export async function obtener(req: Request, res: Response): Promise<void> {
  res.json(await servicio.obtener(idUsuario(req), idBloque(req)));
}

export async function reemplazar(req: Request, res: Response): Promise<void> {
  res.json(await servicio.reemplazar(idUsuario(req), idBloque(req), req.valid.body as DatosBloque));
}

export async function actualizar(req: Request, res: Response): Promise<void> {
  res.json(
    await servicio.actualizar(idUsuario(req), idBloque(req), req.valid.body as DatosBloqueParcial),
  );
}

export async function eliminar(req: Request, res: Response): Promise<void> {
  await servicio.eliminar(idUsuario(req), idBloque(req));
  res.status(204).end();
}
