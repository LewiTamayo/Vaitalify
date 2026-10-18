import type { Request, Response } from 'express';
import type { DatosConfig, Tipo } from './config-notificaciones.schemas.js';
import * as servicio from './config-notificaciones.service.js';

// requireAuth garantiza req.usuario; validate garantiza params y body.
const idUsuario = (req: Request) => req.usuario!.idUsuario;
const tipo = (req: Request) => (req.valid.params as { tipo: Tipo }).tipo;

export async function listar(req: Request, res: Response): Promise<void> {
  res.json(await servicio.listar(idUsuario(req)));
}

export async function crear(req: Request, res: Response): Promise<void> {
  const { tipo: nuevo, ...datos } = req.valid.body as DatosConfig & { tipo: Tipo };
  const config = await servicio.crear(idUsuario(req), nuevo, datos);
  res.status(201).location(`/api/v1/config-notificaciones/${config.tipo}`).json(config);
}

export async function obtener(req: Request, res: Response): Promise<void> {
  res.json(await servicio.obtener(idUsuario(req), tipo(req)));
}

export async function reemplazar(req: Request, res: Response): Promise<void> {
  res.json(await servicio.reemplazar(idUsuario(req), tipo(req), req.valid.body as DatosConfig));
}

export async function restablecer(req: Request, res: Response): Promise<void> {
  await servicio.restablecer(idUsuario(req), tipo(req));
  res.status(204).end();
}
