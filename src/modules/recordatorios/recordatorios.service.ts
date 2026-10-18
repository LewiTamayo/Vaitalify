import { env } from '../../config/env.js';
import { esUnicoViolado } from '../../common/db/errores-prisma.js';
import { errores } from '../../common/errors/app-error.js';
import { logger } from '../../common/logger.js';
import { hoyEnZona, sumarDias } from '../../common/utils/dates.js';
import { pagina, type Pagina } from '../../common/utils/pagination.js';
import { planDelDia } from '../sueno/sueno.service.js';
import {
  ambitoDia,
  aplicarConfig,
  instanteDia,
  planSincronizacion,
  recordatoriosDelDia,
} from './recordatorios.domain.js';
import * as repo from './recordatorios.repository.js';
import type {
  ActualizarRecordatorio,
  FiltrosRecordatorios,
  RecordatorioDto,
  ResultadoGeneracion,
} from './recordatorios.schemas.js';

const noEncontrado = () => errores.noEncontrado('El recordatorio no existe');
const zona = () => env.APP_TZ;

function aDto(r: repo.FilaRecordatorio): RecordatorioDto {
  return {
    idRecordatorio: r.idRecordatorio,
    tipo: r.tipo,
    mensaje: r.mensaje,
    fechaHoraEnvio: r.fechaHoraEnvio.toISOString(),
    enviado: r.enviado,
  };
}

// Genera (idempotente) los recordatorios de sueño y de pausas del día respetando la config.
export async function generar(
  idUsuario: number,
  fecha: string = hoyEnZona(),
): Promise<ResultadoGeneracion> {
  const [plan, pausas, configs] = await Promise.all([
    planDelDia(idUsuario, fecha),
    repo.pausasPendientes(idUsuario, fecha),
    repo.configs(idUsuario),
  ]);
  const deseados = aplicarConfig(recordatoriosDelDia(fecha, plan, pausas, zona()), configs, zona());
  const { desde, hasta } = ambitoDia(fecha, zona());
  const sincronizacion = planSincronizacion(await repo.enRango(idUsuario, desde, hasta), deseados);
  await repo.sincronizar(idUsuario, sincronizacion);
  return {
    generados: sincronizacion.crear.length,
    eliminados: sincronizacion.eliminar.length,
    conservados: sincronizacion.conservados,
  };
}

// Tras cambios en bloques, perfil, micro-pausas o configuración (§7.7.3). Los recordatorios son
// datos derivados: un fallo aquí no debe convertir en 500 una operación que ya se guardó.
export async function regenerarSinFallar(
  idUsuario: number,
  fecha: string = hoyEnZona(),
): Promise<void> {
  try {
    await generar(idUsuario, fecha);
  } catch (err) {
    logger.error({ err, idUsuario, fecha }, 'No se pudieron regenerar los recordatorios');
  }
}

export async function listar(
  idUsuario: number,
  filtros: FiltrosRecordatorios,
): Promise<Pagina<RecordatorioDto>> {
  const { filas, total } = await repo.listar(
    idUsuario,
    {
      tipo: filtros.tipo,
      enviado: filtros.enviado,
      desde: filtros.desde ? instanteDia(filtros.desde, '00:00', zona()) : undefined,
      hasta: filtros.hasta ? instanteDia(sumarDias(filtros.hasta, 1), '00:00', zona()) : undefined,
    },
    filtros,
  );
  return pagina(filas.map(aDto), total, filtros);
}

// Lo que la app móvil programa como notificaciones locales (S-15): no enviados, de tipos
// activos, entre ahora y dentro de `horas` horas.
export async function pendientes(idUsuario: number, horas: number): Promise<RecordatorioDto[]> {
  const inactivos = new Set(
    (await repo.configs(idUsuario)).filter((c) => !c.activa).map((c) => c.tipo),
  );
  const tipos = (['sueno', 'pausa'] as const).filter((t) => !inactivos.has(t));
  const ahora = new Date();
  const hasta = new Date(ahora.getTime() + horas * 3_600_000);
  return (await repo.pendientes(idUsuario, ahora, hasta, tipos)).map(aDto);
}

export async function obtener(idUsuario: number, id: number): Promise<RecordatorioDto> {
  const r = await repo.buscar(idUsuario, id);
  if (!r) throw noEncontrado();
  return aDto(r);
}

export async function actualizar(
  idUsuario: number,
  id: number,
  cambios: ActualizarRecordatorio,
): Promise<RecordatorioDto> {
  const actual = await repo.buscar(idUsuario, id);
  if (!actual) throw noEncontrado();
  const editaContenido = cambios.mensaje !== undefined || cambios.fechaHoraEnvio !== undefined;
  if (editaContenido && actual.enviado) {
    throw errores.reglaNegocio('No se puede editar un recordatorio que ya se envió');
  }
  try {
    const r = await repo.actualizar(idUsuario, id, {
      mensaje: cambios.mensaje,
      fechaHoraEnvio: cambios.fechaHoraEnvio ? new Date(cambios.fechaHoraEnvio) : undefined,
      enviado: cambios.enviado,
    });
    if (!r) throw noEncontrado();
    return aDto(r);
  } catch (error) {
    if (esUnicoViolado(error)) {
      throw errores.conflicto('Ya hay un recordatorio de ese tipo a esa hora');
    }
    throw error;
  }
}

export async function eliminar(idUsuario: number, id: number): Promise<void> {
  if (!(await repo.eliminar(idUsuario, id))) throw noEncontrado();
}
