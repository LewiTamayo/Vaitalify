import { esNoEncontrado, esUnicoViolado } from '../../common/db/errores-prisma.js';
import { errores } from '../../common/errors/app-error.js';
import { formatHHmm } from '../../common/utils/time.js';
import { recalcularSemanaSinFallar } from '../micro-ventanas/micro-ventanas.service.js';
import { regenerarSinFallar } from '../recordatorios/recordatorios.service.js';
import * as repo from './perfil.repository.js';
import {
  validarPerfilCompleto,
  type DatosPerfil,
  type DatosPerfilParcial,
  type PerfilDto,
} from './perfil.schemas.js';

const sinPerfil = () =>
  errores.noEncontrado(
    'Aún no has configurado tu perfil',
    'Crea tu perfil con POST /perfil. Sugerido (OMS): metaHorasSueno 7.5 y metaMinActividad 150',
  );

// Tras cambiar el horario: micro-ventanas de la semana y recordatorios de hoy (datos derivados).
async function trasCambiarHorario(idUsuario: number): Promise<void> {
  await recalcularSemanaSinFallar(idUsuario);
  await regenerarSinFallar(idUsuario);
}

function aDto(p: repo.FilaPerfil): PerfilDto {
  return {
    idPerfil: p.idPerfil,
    horaDormir: formatHHmm(p.horaDormir),
    horaDespertar: formatHHmm(p.horaDespertar),
    metaHorasSueno: p.metaHorasSueno.toNumber(),
    metaMinActividad: p.metaMinActividad,
  };
}

export async function obtener(idUsuario: number): Promise<PerfilDto> {
  const perfil = await repo.buscar(idUsuario);
  if (!perfil) throw sinPerfil();
  return aDto(perfil);
}

export async function crear(idUsuario: number, datos: DatosPerfil): Promise<PerfilDto> {
  try {
    const perfil = aDto(await repo.crear(idUsuario, datos));
    // El día despierto define las micro-ventanas: se recalculan al cambiar el perfil.
    await trasCambiarHorario(idUsuario);
    return perfil;
  } catch (error) {
    if (esUnicoViolado(error)) throw errores.conflicto('Ya tienes un perfil; usa PUT o PATCH');
    throw error;
  }
}

export async function reemplazar(idUsuario: number, datos: DatosPerfil): Promise<PerfilDto> {
  try {
    const perfil = aDto(await repo.actualizar(idUsuario, datos));
    await trasCambiarHorario(idUsuario);
    return perfil;
  } catch (error) {
    if (esNoEncontrado(error)) throw sinPerfil();
    throw error;
  }
}

// PATCH: se combina con lo guardado y se validan las reglas sobre el resultado.
export async function actualizar(
  idUsuario: number,
  cambios: DatosPerfilParcial,
): Promise<PerfilDto> {
  const { horaDormir, horaDespertar, metaHorasSueno, metaMinActividad } = await obtener(idUsuario);
  const combinado = { horaDormir, horaDespertar, metaHorasSueno, metaMinActividad, ...cambios };
  validarPerfilCompleto(combinado);
  return reemplazar(idUsuario, combinado);
}

export async function eliminar(idUsuario: number): Promise<void> {
  if (!(await repo.eliminar(idUsuario))) throw sinPerfil();
  // Sin perfil no hay plan de sueño: se quitan sus recordatorios de hoy.
  await regenerarSinFallar(idUsuario);
}
