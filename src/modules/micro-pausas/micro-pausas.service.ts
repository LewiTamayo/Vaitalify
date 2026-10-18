import { esFkViolada, esUnicoViolado } from '../../common/db/errores-prisma.js';
import { errores } from '../../common/errors/app-error.js';
import { formatFecha, hoyEnZona } from '../../common/utils/dates.js';
import { pagina, type Pagina } from '../../common/utils/pagination.js';
import { crearRng, type Rng } from '../../common/utils/random.js';
import { formatHHmm } from '../../common/utils/time.js';
import * as actividades from '../actividades/actividades.service.js';
import * as ventanas from '../micro-ventanas/micro-ventanas.service.js';
import * as gamificacion from '../progreso/gamificacion.service.js';
import { regenerarSinFallar } from '../recordatorios/recordatorios.service.js';
import * as repo from './micro-pausas.repository.js';
import type {
  Estado,
  FiltrosPausas,
  MicroPausaConProgresoDto,
  MicroPausaDto,
} from './micro-pausas.schemas.js';
import { recomendarActividad } from './recomendacion.domain.js';

const noEncontrada = () => errores.noEncontrado('La micro-pausa no existe');
const yaTienePausa = () => errores.conflicto('La micro-ventana ya tiene una micro-pausa asignada');
const noCabe = () => errores.reglaNegocio('La actividad no cabe en la micro-ventana');
const ventanaNoExiste = () => errores.noEncontrado('La micro-ventana no existe');

interface Elegida {
  idActividad: number;
  duracionMin: number;
}

export function aDto(p: repo.FilaPausa): MicroPausaDto {
  return {
    idPausa: p.idPausa,
    estado: p.estado,
    fechaRegistro: p.fechaRegistro?.toISOString() ?? null,
    ventana: {
      idVentana: p.ventana.idVentana,
      fecha: formatFecha(p.ventana.fecha),
      horaInicio: formatHHmm(p.ventana.horaInicio),
      duracionMin: p.ventana.duracionMin,
    },
    actividad: actividades.aDto(p.actividad),
  };
}

async function obtenerFila(idUsuario: number, idPausa: number): Promise<repo.FilaPausa> {
  const pausa = await repo.buscar(idUsuario, idPausa);
  if (!pausa) throw noEncontrada();
  return pausa;
}

async function actividadQueCabe(idActividad: number, duracionVentana: number): Promise<Elegida> {
  const actividad = await actividades.obtener(idActividad);
  if (actividad.duracionMin > duracionVentana) throw noCabe();
  return actividad;
}

async function elegirActividad(
  idUsuario: number,
  duracionVentana: number,
  rng: Rng,
): Promise<Elegida> {
  const [candidatas, ultima] = await Promise.all([
    actividades.candidatas(duracionVentana),
    repo.ultimaActividad(idUsuario),
  ]);
  const elegida = recomendarActividad(candidatas, duracionVentana, ultima, rng);
  const actividad = candidatas.find((c) => c.idActividad === elegida);
  if (!actividad) {
    throw errores.reglaNegocio('No hay actividades que quepan en esta micro-ventana');
  }
  return actividad;
}

async function insertar(idUsuario: number, idVentana: number, elegida: Elegida): Promise<number> {
  try {
    const resultado = await repo.crear(
      idUsuario,
      idVentana,
      elegida.idActividad,
      elegida.duracionMin,
    );
    if (resultado === 'sin-ventana') throw ventanaNoExiste();
    if (resultado === 'no-cabe') throw noCabe();
    return resultado.idPausa;
  } catch (error) {
    if (esUnicoViolado(error)) throw yaTienePausa();
    if (esFkViolada(error)) throw ventanaNoExiste();
    throw error;
  }
}

// RF-05 / §7.2: recomienda (o asigna la forzada) una actividad para la micro-ventana.
export async function recomendar(
  idUsuario: number,
  idVentana: number,
  idActividad?: number,
  rng: Rng = crearRng(),
): Promise<MicroPausaDto> {
  const ventana = await ventanas.obtener(idUsuario, idVentana);
  if (ventana.microPausa) throw yaTienePausa();
  const elegida =
    idActividad === undefined
      ? await elegirActividad(idUsuario, ventana.duracionMin, rng)
      : await actividadQueCabe(idActividad, ventana.duracionMin);
  const idPausa = await insertar(idUsuario, idVentana, elegida);
  await regenerarSinFallar(idUsuario, ventana.fecha);
  return aDto(await obtenerFila(idUsuario, idPausa));
}

export async function listar(
  idUsuario: number,
  filtros: FiltrosPausas,
): Promise<Pagina<MicroPausaDto>> {
  const { filas, total } = await repo.listar(idUsuario, filtros);
  return pagina(filas.map(aDto), total, filtros);
}

// Pantalla "Hoy" (RNF-02): las micro-pausas del día en APP_TZ, ordenadas por hora.
export async function hoy(idUsuario: number): Promise<MicroPausaDto[]> {
  return (await repo.delDia(idUsuario, hoyEnZona())).map(aDto);
}

export async function obtener(idUsuario: number, idPausa: number): Promise<MicroPausaDto> {
  return aDto(await obtenerFila(idUsuario, idPausa));
}

// RF-07: una sola llamada. U-7: no se puede marcar como hecha una pausa de un día futuro.
export async function cambiarEstado(
  idUsuario: number,
  idPausa: number,
  estado: Estado,
): Promise<MicroPausaConProgresoDto> {
  const pausa = await obtenerFila(idUsuario, idPausa);
  if (estado === 'hecha' && formatFecha(pausa.ventana.fecha) > hoyEnZona()) {
    throw errores.reglaNegocio('No puedes marcar como hecha una micro-pausa de un día futuro');
  }
  const actualizada = await repo.actualizar(idUsuario, idPausa, {
    estado,
    fechaRegistro: new Date(),
  });
  if (!actualizada) throw noEncontrada();
  // Una pausa hecha u omitida ya no necesita su recordatorio.
  await regenerarSinFallar(idUsuario, formatFecha(pausa.ventana.fecha));
  // §6.6: la respuesta incluye puntos ganados, racha e insignias nuevas (§7.4).
  const progreso = await gamificacion.trasCambioDePausa(idUsuario, idPausa, estado);
  return { ...aDto(actualizada), ...progreso };
}

export async function cambiarActividad(
  idUsuario: number,
  idPausa: number,
  idActividad: number,
): Promise<MicroPausaDto> {
  const pausa = await obtenerFila(idUsuario, idPausa);
  if (pausa.estado !== 'pendiente') {
    throw errores.reglaNegocio('Solo se puede cambiar la actividad de una micro-pausa pendiente');
  }
  const elegida = await actividadQueCabe(idActividad, pausa.ventana.duracionMin);
  const actualizada = await repo.actualizar(idUsuario, idPausa, {
    idActividad: elegida.idActividad,
  });
  if (!actualizada) throw noEncontrada();
  await regenerarSinFallar(idUsuario, formatFecha(pausa.ventana.fecha));
  return aDto(actualizada);
}

// S-09: borrar una pausa hecha no revierte puntos.
export async function eliminar(idUsuario: number, idPausa: number): Promise<void> {
  const pausa = await obtenerFila(idUsuario, idPausa);
  if (!(await repo.eliminar(idUsuario, idPausa))) throw noEncontrada();
  await regenerarSinFallar(idUsuario, formatFecha(pausa.ventana.fecha));
  if (pausa.estado === 'hecha') await gamificacion.recalcularSinFallar(idUsuario);
}
