import { errores } from '../../common/errors/app-error.js';
import { logger } from '../../common/logger.js';
import {
  diasEntre,
  formatFecha,
  hoyEnZona,
  isoWeekday,
  rangoFechas,
  sumarDias,
} from '../../common/utils/dates.js';
import { pagina, type Pagina } from '../../common/utils/pagination.js';
import { deMinutos, formatHHmm } from '../../common/utils/time.js';
import {
  detectarVentanasDia,
  diaDespierto,
  planificarReconciliacion,
  type VentanaCalculada,
} from './micro-ventanas.domain.js';
import * as repo from './micro-ventanas.repository.js';
import {
  MAX_DIAS_RECALCULO,
  type FiltrosVentanas,
  type MicroVentanaDto,
  type RangoRecalculo,
  type ResultadoRecalculo,
} from './micro-ventanas.schemas.js';

const DIAS_POR_DEFECTO = 7;

const sinPerfil = () =>
  errores.reglaNegocio('Configura tu perfil primero', 'Crea tu perfil con POST /perfil');
const noEncontrada = () => errores.noEncontrado('La micro-ventana no existe');

function resolverRango({ desde, hasta }: RangoRecalculo): { desde: string; hasta: string } {
  const inicio = desde ?? hoyEnZona();
  const fin = hasta ?? sumarDias(inicio, DIAS_POR_DEFECTO - 1);
  const dias = diasEntre(inicio, fin);
  if (dias < 0) {
    throw errores.validacion([{ campo: 'hasta', mensaje: 'hasta no puede ser anterior a desde' }]);
  }
  if (dias >= MAX_DIAS_RECALCULO) {
    throw errores.validacion([
      { campo: 'hasta', mensaje: `El rango no puede superar ${MAX_DIAS_RECALCULO} días` },
    ]);
  }
  return { desde: inicio, hasta: fin };
}

function calcular(horario: repo.Horario, fechas: string[]): VentanaCalculada[] {
  const { perfil } = horario;
  if (!perfil) return [];
  const despierto = diaDespierto(perfil.horaDespertar, perfil.horaDormir);
  return fechas.flatMap((fecha) => {
    const dia = isoWeekday(fecha);
    const bloques = horario.bloques.filter((b) => b.diaSemana === dia);
    return detectarVentanasDia(bloques, despierto).map((v) => ({
      fecha,
      horaInicio: deMinutos(v.inicio),
      duracionMin: v.duracionMin,
    }));
  });
}

type Fechas = { desde: string; hasta: string };

// Lee el horario y las ventanas existentes DENTRO del bloqueo por usuario: dos recálculos
// simultáneos (p. ej. dos POST /bloques seguidos) no pueden aplicar planes obsoletos.
// sinPerfilHacer decide qué hacer si el usuario aún no tiene perfil.
function reconciliar(
  idUsuario: number,
  { desde, hasta }: Fechas,
  sinPerfilHacer: () => ResultadoRecalculo,
): Promise<ResultadoRecalculo> {
  return repo.conBloqueo(idUsuario, async (tx) => {
    const horario = await repo.cargarHorario(idUsuario, tx);
    if (!horario.perfil) return sinPerfilHacer();
    const plan = planificarReconciliacion(
      await repo.existentes(idUsuario, desde, hasta, tx),
      calcular(horario, rangoFechas(desde, hasta)),
    );
    await repo.aplicar(idUsuario, plan, tx);
    return {
      generadas: plan.crear.length,
      eliminadas: plan.eliminar.length,
      conservadas: plan.conservadas,
    };
  });
}

const SIN_CAMBIOS: ResultadoRecalculo = { generadas: 0, eliminadas: 0, conservadas: 0 };

export function recalcular(
  idUsuario: number,
  rango: RangoRecalculo = {},
): Promise<ResultadoRecalculo> {
  return reconciliar(idUsuario, resolverRango(rango), () => {
    throw sinPerfil();
  });
}

// Tras cualquier cambio en bloques o perfil (RNF-03). Sin perfil no hay día despierto: se omite.
export async function recalcularSemana(idUsuario: number): Promise<void> {
  await reconciliar(idUsuario, resolverRango({}), () => SIN_CAMBIOS);
}

// Variante para los hooks de bloques/perfil: el cambio del usuario ya se guardó y las ventanas
// son datos derivados (el próximo recálculo las repara). Un fallo aquí no debe convertir la
// operación en un 500, porque el cliente reintentaría y duplicaría el bloque.
export async function recalcularSemanaSinFallar(idUsuario: number): Promise<void> {
  try {
    await recalcularSemana(idUsuario);
  } catch (err) {
    logger.error({ err, idUsuario }, 'No se pudieron recalcular las micro-ventanas');
  }
}

export function aDto(v: repo.FilaVentana): MicroVentanaDto {
  return {
    idVentana: v.idVentana,
    fecha: formatFecha(v.fecha),
    horaInicio: formatHHmm(v.horaInicio),
    duracionMin: v.duracionMin,
    microPausa: v.microPausa,
  };
}

export async function listar(
  idUsuario: number,
  filtros: FiltrosVentanas,
): Promise<Pagina<MicroVentanaDto>> {
  const { filas, total } = await repo.listar(idUsuario, filtros);
  return pagina(filas.map(aDto), total, filtros);
}

export async function obtener(idUsuario: number, idVentana: number): Promise<MicroVentanaDto> {
  const ventana = await repo.buscar(idUsuario, idVentana);
  if (!ventana) throw noEncontrada();
  return aDto(ventana);
}

export async function eliminar(idUsuario: number, idVentana: number): Promise<void> {
  if (!(await repo.eliminar(idUsuario, idVentana))) throw noEncontrada();
}
