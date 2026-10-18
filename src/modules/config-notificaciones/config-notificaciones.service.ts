import { esNoEncontrado, esUnicoViolado } from '../../common/db/errores-prisma.js';
import { errores } from '../../common/errors/app-error.js';
import { formatHHmm } from '../../common/utils/time.js';
import { regenerarSinFallar } from '../recordatorios/recordatorios.service.js';
import * as repo from './config-notificaciones.repository.js';
import type { ConfigDto, DatosConfig, Tipo } from './config-notificaciones.schemas.js';

const noEncontrada = () => errores.noEncontrado('No hay configuración para ese tipo');

const hora = (d: Date | null) => (d ? formatHHmm(d) : null);

function aDto(c: repo.FilaConfig): ConfigDto {
  return {
    tipo: c.tipo,
    activa: c.activa,
    silencioInicio: hora(c.silencioInicio),
    silencioFin: hora(c.silencioFin),
  };
}

export async function listar(idUsuario: number): Promise<ConfigDto[]> {
  return (await repo.listar(idUsuario)).map(aDto);
}

export async function obtener(idUsuario: number, tipo: Tipo): Promise<ConfigDto> {
  const config = await repo.buscar(idUsuario, tipo);
  if (!config) throw noEncontrada();
  return aDto(config);
}

export async function crear(idUsuario: number, tipo: Tipo, datos: DatosConfig): Promise<ConfigDto> {
  try {
    const config = aDto(await repo.crear(idUsuario, tipo, datos));
    await regenerarSinFallar(idUsuario);
    return config;
  } catch (error) {
    if (esUnicoViolado(error)) {
      throw errores.conflicto('Ya existe la configuración de ese tipo; usa PUT');
    }
    throw error;
  }
}

export async function reemplazar(
  idUsuario: number,
  tipo: Tipo,
  datos: DatosConfig,
): Promise<ConfigDto> {
  try {
    const config = aDto(await repo.actualizar(idUsuario, tipo, datos));
    // Los recordatorios de hoy se rehacen con la nueva configuración (activo / silencio).
    await regenerarSinFallar(idUsuario);
    return config;
  } catch (error) {
    if (esNoEncontrado(error)) throw noEncontrada();
    throw error;
  }
}

// DELETE restablece los valores por defecto (activa, sin silencio).
export async function restablecer(idUsuario: number, tipo: Tipo): Promise<void> {
  await repo.restablecer(idUsuario, tipo);
  await regenerarSinFallar(idUsuario);
}
