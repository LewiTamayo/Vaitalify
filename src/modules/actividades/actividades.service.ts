import { esFkViolada, esNoEncontrado } from '../../common/db/errores-prisma.js';
import { errores } from '../../common/errors/app-error.js';
import { pagina, type Pagina } from '../../common/utils/pagination.js';
import type { Candidata } from '../micro-pausas/recomendacion.domain.js';
import * as repo from './actividades.repository.js';
import type {
  ActividadDto,
  DatosActividad,
  DatosActividadParcial,
  FiltrosActividades,
} from './actividades.schemas.js';

const noEncontrada = () => errores.noEncontrado('La actividad no existe');

export function aDto(a: repo.FilaActividad): ActividadDto {
  return {
    idActividad: a.idActividad,
    nombre: a.nombre,
    categoria: a.categoria as ActividadDto['categoria'],
    duracionMin: a.duracionMin,
    instrucciones: a.instrucciones,
  };
}

async function conMapeo<T>(operacion: () => Promise<T>): Promise<T> {
  try {
    return await operacion();
  } catch (error) {
    if (esNoEncontrado(error)) throw noEncontrada();
    if (esFkViolada(error)) {
      throw errores.conflicto('La actividad tiene micro-pausas asociadas; no se puede eliminar');
    }
    throw error;
  }
}

export async function listar(filtros: FiltrosActividades): Promise<Pagina<ActividadDto>> {
  const { filas, total } = await repo.listar(filtros);
  return pagina(filas.map(aDto), total, filtros);
}

export async function obtener(idActividad: number): Promise<ActividadDto> {
  const actividad = await repo.buscar(idActividad);
  if (!actividad) throw noEncontrada();
  return aDto(actividad);
}

export async function crear(datos: DatosActividad): Promise<ActividadDto> {
  return aDto(await repo.crear(datos));
}

export function actualizar(
  idActividad: number,
  datos: DatosActividad | DatosActividadParcial,
): Promise<ActividadDto> {
  return conMapeo(async () => aDto(await repo.actualizar(idActividad, datos)));
}

export async function eliminar(idActividad: number): Promise<void> {
  await conMapeo(() => repo.eliminar(idActividad));
}

// Para la recomendación de micro-pausas (§7.2).
export function candidatas(maxDuracion: number): Promise<Candidata[]> {
  return repo.candidatas(maxDuracion);
}
