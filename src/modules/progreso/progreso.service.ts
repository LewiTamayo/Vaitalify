import { hoyEnZona } from '../../common/utils/dates.js';
import { calcularRacha, rachaVigente, type EstadoRacha } from './gamificacion.domain.js';
import { diasActivos } from './gamificacion.repository.js';
import { resumenActividad, resumenSueno, semanaDe } from './progreso.domain.js';
import * as repo from './progreso.repository.js';
import type { ProgresoDto, ResumenSemanal } from './progreso.schemas.js';

// La racha se calcula sobre los datos (U-7) y se muestra la vigente: una racha vieja no se
// presenta como actual aunque la caché de Progreso todavía la tenga.
async function rachaDe(idUsuario: number): Promise<EstadoRacha> {
  return calcularRacha(await diasActivos(idUsuario));
}

export async function obtener(idUsuario: number): Promise<ProgresoDto> {
  const [fila, racha] = await Promise.all([repo.puntos(idUsuario), rachaDe(idUsuario)]);
  const vigente = rachaVigente(racha, hoyEnZona());
  return {
    puntosTotales: fila?.puntosTotales ?? 0,
    rachaActual: vigente.rachaActual,
    rachaMaxima: racha.rachaMaxima,
    diasComodin: vigente.comodinesRestantes,
    ultimaFechaActiva: racha.ultimaFechaActiva,
  };
}

// RF-09 / §7.5: resumen de la semana ISO que contiene `fecha`.
export async function semanal(
  idUsuario: number,
  fecha: string = hoyEnZona(),
): Promise<ResumenSemanal> {
  const semana = semanaDe(fecha);
  const [metas, registros, pausas, insignias, racha] = await Promise.all([
    repo.metas(idUsuario),
    repo.registrosSueno(idUsuario, semana.inicio, semana.fin),
    repo.pausas(idUsuario, semana.inicio, semana.fin),
    repo.insigniasDeLaSemana(idUsuario, semana.inicio, semana.fin),
    rachaDe(idUsuario),
  ]);
  const vigente = rachaVigente(racha, hoyEnZona());
  return {
    semana,
    sueno: resumenSueno(registros, metas.metaHoras),
    actividad: resumenActividad(pausas, metas.metaMinutos),
    racha: { actual: vigente.rachaActual, comodinesRestantes: vigente.comodinesRestantes },
    insignias,
  };
}
