import type { Request, Response } from 'express';
import type { ActualizarRecordatorio, FiltrosRecordatorios } from './recordatorios.schemas.js';
import * as servicio from './recordatorios.service.js';

// requireAuth garantiza req.usuario; validate garantiza params, query y body.
const idUsuario = (req: Request) => req.usuario!.idUsuario;
const id = (req: Request) => (req.valid.params as { id: number }).id;

export async function generar(req: Request, res: Response): Promise<void> {
  const { fecha } = req.valid.body as { fecha?: string };
  res.json(await servicio.generar(idUsuario(req), fecha));
}

export async function listar(req: Request, res: Response): Promise<void> {
  res.json(await servicio.listar(idUsuario(req), req.valid.query as FiltrosRecordatorios));
}

export async function pendientes(req: Request, res: Response): Promise<void> {
  const { horas } = req.valid.query as { horas: number };
  res.json(await servicio.pendientes(idUsuario(req), horas));
}

export async function obtener(req: Request, res: Response): Promise<void> {
  res.json(await servicio.obtener(idUsuario(req), id(req)));
}

export async function actualizar(req: Request, res: Response): Promise<void> {
  const cambios = req.valid.body as ActualizarRecordatorio;
  res.json(await servicio.actualizar(idUsuario(req), id(req), cambios));
}

export async function eliminar(req: Request, res: Response): Promise<void> {
  await servicio.eliminar(idUsuario(req), id(req));
  res.status(204).end();
}
