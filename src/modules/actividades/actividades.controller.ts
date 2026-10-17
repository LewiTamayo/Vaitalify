import type { Request, Response } from 'express';
import type {
  DatosActividad,
  DatosActividadParcial,
  FiltrosActividades,
} from './actividades.schemas.js';
import * as servicio from './actividades.service.js';

// validate garantiza params.id.
const idActividad = (req: Request) => (req.valid.params as { id: number }).id;

export async function listar(req: Request, res: Response): Promise<void> {
  res.json(await servicio.listar(req.valid.query as FiltrosActividades));
}

export async function obtener(req: Request, res: Response): Promise<void> {
  res.json(await servicio.obtener(idActividad(req)));
}

export async function crear(req: Request, res: Response): Promise<void> {
  const actividad = await servicio.crear(req.valid.body as DatosActividad);
  res.status(201).location(`/api/v1/actividades/${actividad.idActividad}`).json(actividad);
}

export async function actualizar(req: Request, res: Response): Promise<void> {
  const datos = req.valid.body as DatosActividad | DatosActividadParcial;
  res.json(await servicio.actualizar(idActividad(req), datos));
}

export async function eliminar(req: Request, res: Response): Promise<void> {
  await servicio.eliminar(idActividad(req));
  res.status(204).end();
}
