import { esNoEncontrado, esUnicoViolado } from '../../common/db/errores-prisma.js';
import { errores } from '../../common/errors/app-error.js';
import { formatFecha } from '../../common/utils/dates.js';
import * as repo from './insignias.repository.js';
import type { DatosInsignia, InsigniaDto, InsigniaUsuarioDto } from './insignias.schemas.js';

async function conMapeo<T>(operacion: () => Promise<T>): Promise<T> {
  try {
    return await operacion();
  } catch (error) {
    if (esUnicoViolado(error)) throw errores.conflicto('Ya existe una insignia con ese código');
    if (esNoEncontrado(error)) throw errores.noEncontrado('La insignia no existe');
    throw error;
  }
}

const aDto = ({ idInsignia, codigo, nombre, descripcion, criterio }: InsigniaDto): InsigniaDto => ({
  idInsignia,
  codigo,
  nombre,
  descripcion,
  criterio,
});

// Catálogo con el estado del usuario (§6.11).
export async function catalogo(idUsuario: number): Promise<InsigniaUsuarioDto[]> {
  const filas = await repo.catalogoConUsuario(idUsuario);
  return filas.map((i) => {
    const obtenida = i.usuarios[0];
    return {
      ...aDto(i),
      obtenida: obtenida !== undefined,
      fechaObtencion: obtenida ? formatFecha(obtenida.fechaObtencion) : null,
    };
  });
}

export async function propias(idUsuario: number): Promise<InsigniaUsuarioDto[]> {
  return (await catalogo(idUsuario)).filter((i) => i.obtenida);
}

export async function crear(datos: DatosInsignia): Promise<InsigniaDto> {
  return aDto(await conMapeo(() => repo.crear(datos)));
}

export async function reemplazar(idInsignia: number, datos: DatosInsignia): Promise<InsigniaDto> {
  return aDto(await conMapeo(() => repo.reemplazar(idInsignia, datos)));
}

// Borra también las asignaciones a usuarios (cascada).
export async function eliminar(idInsignia: number): Promise<void> {
  await conMapeo(() => repo.eliminar(idInsignia));
}
