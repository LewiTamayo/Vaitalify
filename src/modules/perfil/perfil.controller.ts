import type { Request, Response } from 'express';
import type { DatosPerfil, DatosPerfilParcial } from './perfil.schemas.js';
import * as servicio from './perfil.service.js';

// requireAuth garantiza req.usuario.
const idDe = (req: Request) => req.usuario!.idUsuario;

export async function crear(req: Request, res: Response): Promise<void> {
  const perfil = await servicio.crear(idDe(req), req.valid.body as DatosPerfil);
  res.status(201).location('/api/v1/perfil').json(perfil);
}

export async function obtener(req: Request, res: Response): Promise<void> {
  res.json(await servicio.obtener(idDe(req)));
}

export async function reemplazar(req: Request, res: Response): Promise<void> {
  res.json(await servicio.reemplazar(idDe(req), req.valid.body as DatosPerfil));
}

export async function actualizar(req: Request, res: Response): Promise<void> {
  res.json(await servicio.actualizar(idDe(req), req.valid.body as DatosPerfilParcial));
}

export async function eliminar(req: Request, res: Response): Promise<void> {
  await servicio.eliminar(idDe(req));
  res.status(204).end();
}
