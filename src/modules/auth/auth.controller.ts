import type { Request, Response } from 'express';
import type { Login, RefreshBody, Registro } from './auth.schemas.js';
import * as servicio from './auth.service.js';

export async function registro(req: Request, res: Response): Promise<void> {
  const sesion = await servicio.registrar(req.valid.body as Registro);
  res.status(201).location('/api/v1/usuarios/me').json(sesion);
}

export async function login(req: Request, res: Response): Promise<void> {
  res.json(await servicio.login(req.valid.body as Login));
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.valid.body as RefreshBody;
  res.json(await servicio.refrescar(refreshToken));
}

export async function logout(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.valid.body as RefreshBody;
  await servicio.logout(req.usuario!.idUsuario, refreshToken);
  res.status(204).end();
}
