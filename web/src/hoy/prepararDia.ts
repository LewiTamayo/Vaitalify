import { api, ErrorApi } from '../api/cliente';
import type { Bloque, MicroVentana, Pagina } from '../api/tipos';
import { hoyEnZona } from './fechas';

// Perfil del ejemplo del spec (§7.3): despertar 06:15, acostarse 22:45, 7,5 h, 150 min (OMS).
export const PERFIL_EJEMPLO = {
  horaDormir: '22:45',
  horaDespertar: '06:15',
  metaHorasSueno: 7.5,
  metaMinActividad: 150,
};

// Jornada de quien estudia y trabaja. Deja 5 huecos en el día despierto:
// 06:15 (45 min), 09:00 (10), 12:00 (30), 16:50 (10) y 20:00 (2 h 45).
const JORNADA: Array<Omit<Bloque, 'diaSemana'>> = [
  { tipo: 'estudio', titulo: 'Clase de la mañana', horaInicio: '07:00', horaFin: '09:00' },
  { tipo: 'trabajo', titulo: 'Turno de trabajo', horaInicio: '09:10', horaFin: '12:00' },
  { tipo: 'trabajo', titulo: 'Turno de la tarde', horaInicio: '12:30', horaFin: '16:50' },
  { tipo: 'estudio', titulo: 'Clase nocturna', horaInicio: '17:00', horaFin: '20:00' },
];

export const HORARIO_EJEMPLO: Bloque[] = [1, 2, 3, 4, 5, 6, 7].flatMap((diaSemana) =>
  JORNADA.map((bloque) => ({ ...bloque, diaSemana })),
);

// Un 409 significa que ese paso ya estaba hecho: se puede repetir sin efectos.
async function tolerarConflicto(peticion: Promise<unknown>): Promise<void> {
  try {
    await peticion;
  } catch (error) {
    if (!(error instanceof ErrorApi && error.status === 409)) throw error;
  }
}

async function asegurarPerfil(): Promise<void> {
  try {
    await api('/perfil');
  } catch (error) {
    if (!(error instanceof ErrorApi && error.status === 404)) throw error;
    await tolerarConflicto(api('/perfil', { metodo: 'POST', cuerpo: PERFIL_EJEMPLO }));
  }
}

async function asegurarHorario(): Promise<void> {
  const { meta } = await api<Pagina<Bloque>>('/bloques?pageSize=1');
  if (meta.total > 0) return;
  // Importar recalcula las micro-ventanas de los próximos 7 días.
  await api('/bloques/importar', { metodo: 'POST', cuerpo: { bloques: HORARIO_EJEMPLO } });
}

async function recomendarPausas(hoy: string): Promise<void> {
  const consulta = `desde=${hoy}&hasta=${hoy}&conPausa=false&pageSize=100`;
  const { data } = await api<Pagina<MicroVentana>>(`/micro-ventanas?${consulta}`);
  for (const { idVentana } of data) {
    await tolerarConflicto(
      api(`/micro-ventanas/${idVentana}/micro-pausa`, { metodo: 'POST', cuerpo: {} }),
    );
  }
}

// Deja listo el día de hoy para la demo. Cada paso se puede repetir sin duplicar nada.
export async function prepararDia(hoy: string = hoyEnZona()): Promise<void> {
  await asegurarPerfil();
  await asegurarHorario();
  // Las ventanas solo se generan al cambiar perfil u horario (hoy + 6 días): si el horario
  // ya existía (p. ej. una semana después) o aquel recálculo falló, hoy no tendría ventanas.
  await api('/micro-ventanas/recalcular', { metodo: 'POST', cuerpo: { desde: hoy, hasta: hoy } });
  await recomendarPausas(hoy);
}
