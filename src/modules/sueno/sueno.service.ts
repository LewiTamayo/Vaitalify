import { env } from '../../config/env.js';
import { errores } from '../../common/errors/app-error.js';
import { hoyEnZona, isoWeekday, sumarDias } from '../../common/utils/dates.js';
import { calcularPlanSueno, type PlanSueno } from './sueno.domain.js';
import * as repo from './sueno.repository.js';
import type { RecomendacionSueno } from './sueno.schemas.js';

const sinPerfil = () =>
  errores.reglaNegocio('Configura tu perfil primero', 'Crea tu perfil con POST /perfil');

// Plan de la noche de `fecha` según la primera actividad del día siguiente. null sin perfil.
export async function planDelDia(idUsuario: number, fecha: string): Promise<PlanSueno | null> {
  const { perfil, bloques } = await repo.cargar(idUsuario, isoWeekday(sumarDias(fecha, 1)));
  return perfil && calcularPlanSueno(perfil, bloques, env.MARGEN_PREPARACION_MIN);
}

export async function recomendacion(
  idUsuario: number,
  fecha: string = hoyEnZona(),
): Promise<RecomendacionSueno> {
  const plan = await planDelDia(idUsuario, fecha);
  if (!plan) throw sinPerfil();
  return {
    fecha,
    horaSugeridaAcostarse: plan.acostarse,
    horaDespertar: plan.despertar,
    primeraActividad: plan.primeraActividad,
    horasDeSuenoLogradas: plan.horasDeSuenoLogradas,
    checklist: plan.checklist,
  };
}
