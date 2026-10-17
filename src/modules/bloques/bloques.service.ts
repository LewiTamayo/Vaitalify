import { errores } from '../../common/errors/app-error.js';
import { pagina, type Pagina } from '../../common/utils/pagination.js';
import { formatHHmm } from '../../common/utils/time.js';
import * as repo from './bloques.repository.js';
import {
  validarBloque,
  type BloqueDto,
  type DatosBloque,
  type DatosBloqueParcial,
  type FiltrosBloques,
} from './bloques.schemas.js';

const noEncontrado = () => errores.noEncontrado('El bloque no existe');

export function aDto(b: repo.FilaBloque): BloqueDto {
  return {
    idBloque: b.idBloque,
    tipo: b.tipo,
    titulo: b.titulo,
    diaSemana: b.diaSemana,
    horaInicio: formatHHmm(b.horaInicio),
    horaFin: formatHHmm(b.horaFin),
    origen: b.origen,
  };
}

export async function crear(idUsuario: number, datos: DatosBloque): Promise<BloqueDto> {
  return aDto(await repo.crear(idUsuario, datos));
}

export async function listar(
  idUsuario: number,
  filtros: FiltrosBloques,
): Promise<Pagina<BloqueDto>> {
  const { filas, total } = await repo.listar(idUsuario, filtros);
  return pagina(filas.map(aDto), total, filtros);
}

export async function obtener(idUsuario: number, idBloque: number): Promise<BloqueDto> {
  const bloque = await repo.buscar(idUsuario, idBloque);
  if (!bloque) throw noEncontrado();
  return aDto(bloque);
}

export async function reemplazar(
  idUsuario: number,
  idBloque: number,
  datos: DatosBloque,
): Promise<BloqueDto> {
  const bloque = await repo.reemplazar(idUsuario, idBloque, datos);
  if (!bloque) throw noEncontrado();
  return aDto(bloque);
}

// PATCH: se combina con lo guardado y se valida el orden de horas sobre el resultado.
export async function actualizar(
  idUsuario: number,
  idBloque: number,
  cambios: DatosBloqueParcial,
): Promise<BloqueDto> {
  const { tipo, titulo, diaSemana, horaInicio, horaFin } = await obtener(idUsuario, idBloque);
  const combinado = { tipo, titulo, diaSemana, horaInicio, horaFin, ...cambios };
  validarBloque(combinado);
  return reemplazar(idUsuario, idBloque, combinado);
}

export async function eliminar(idUsuario: number, idBloque: number): Promise<void> {
  if (!(await repo.eliminar(idUsuario, idBloque))) throw noEncontrado();
}
