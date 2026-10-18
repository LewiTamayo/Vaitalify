import { prisma } from '../../common/db/prisma.js';
import { formatHHmm } from '../../common/utils/time.js';

// Lectura (solo) del perfil y de los bloques de un día de la semana para el plan de sueño.
export async function cargar(idUsuario: number, diaSemana: number) {
  const [perfil, bloques] = await Promise.all([
    prisma.perfilHabitos.findUnique({ where: { idUsuario } }),
    prisma.bloqueHorario.findMany({
      where: { idUsuario, diaSemana },
      select: { titulo: true, horaInicio: true },
    }),
  ]);
  return {
    perfil: perfil && {
      horaDormir: formatHHmm(perfil.horaDormir),
      horaDespertar: formatHHmm(perfil.horaDespertar),
      metaHorasSueno: perfil.metaHorasSueno.toNumber(),
    },
    bloques: bloques.map((b) => ({ titulo: b.titulo, horaInicio: formatHHmm(b.horaInicio) })),
  };
}
