import { aMinutos, deMinutos } from '../../common/utils/time.js';

// Hora sugerida para acostarse (§7.3). Función pura.

export interface PlanSueno {
  acostarse: string;
  despertar: string;
  horasDeSuenoLogradas: number;
  primeraActividad: { titulo: string; horaInicio: string } | null;
  checklist: { texto: string; hora: string | null }[];
}

interface PerfilSueno {
  horaDormir: string;
  horaDespertar: string;
  metaHorasSueno: number;
}

const MINUTOS_DIA = 1440;
const PANTALLAS_MIN = 30;
const PREPARAR_MIN = 45;

function primeraDelDia<T extends { horaInicio: string }>(bloques: T[]): T | null {
  return bloques.reduce<T | null>(
    (primera, b) => (!primera || b.horaInicio < primera.horaInicio ? b : primera),
    null,
  );
}

const horasEntre = (desde: string, hasta: string) => {
  const minutos = (aMinutos(hasta) - aMinutos(desde) + MINUTOS_DIA) % MINUTOS_DIA;
  return Math.round((minutos / 60) * 10) / 10;
};

export function calcularPlanSueno(
  perfil: PerfilSueno,
  bloquesDiaSiguiente: { titulo: string; horaInicio: string }[],
  margenMin: number,
): PlanSueno {
  const primera = primeraDelDia(bloquesDiaSiguiente);
  // Sin actividades al día siguiente se respeta el horario habitual del perfil.
  const despertar = primera
    ? deMinutos(aMinutos(primera.horaInicio) - margenMin)
    : perfil.horaDespertar;
  const acostarse = primera
    ? deMinutos(aMinutos(despertar) - Math.round(perfil.metaHorasSueno * 60))
    : perfil.horaDormir;
  return {
    acostarse,
    despertar,
    horasDeSuenoLogradas: horasEntre(acostarse, despertar),
    primeraActividad: primera && { titulo: primera.titulo, horaInicio: primera.horaInicio },
    checklist: [
      { texto: 'Deja las pantallas', hora: deMinutos(aMinutos(acostarse) - PANTALLAS_MIN) },
      { texto: 'Prepara lo de mañana', hora: deMinutos(aMinutos(acostarse) - PREPARAR_MIN) },
      { texto: 'Última cafeína antes de las 16:00', hora: null },
    ],
  };
}
