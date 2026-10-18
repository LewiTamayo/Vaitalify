import { conBloqueoVentanas, type Tx } from '../../common/db/bloqueos.js';
import { prisma, type Prisma } from '../../common/db/prisma.js';
import { formatFecha, filtroFechas, parseFecha } from '../../common/utils/dates.js';
import { aSkipTake } from '../../common/utils/pagination.js';
import { formatHHmm, parseHHmm } from '../../common/utils/time.js';
import type {
  PlanReconciliacion,
  VentanaCalculada,
  VentanaExistente,
} from './micro-ventanas.domain.js';
import type { FiltrosVentanas } from './micro-ventanas.schemas.js';

const minutos = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes();

// Lectura del horario del usuario (perfil + bloques). Solo lectura: se consulta aquí para no
// crear un ciclo de imports entre los servicios de bloques/perfil y el de micro-ventanas.
export const conBloqueo = conBloqueoVentanas;

export async function cargarHorario(idUsuario: number, db: Tx = prisma) {
  const [perfil, bloques] = await Promise.all([
    db.perfilHabitos.findUnique({
      where: { idUsuario },
      select: { horaDespertar: true, horaDormir: true },
    }),
    db.bloqueHorario.findMany({
      where: { idUsuario },
      select: { diaSemana: true, horaInicio: true, horaFin: true },
    }),
  ]);
  return {
    perfil: perfil && {
      horaDespertar: formatHHmm(perfil.horaDespertar),
      horaDormir: formatHHmm(perfil.horaDormir),
    },
    bloques: bloques.map((b) => ({
      diaSemana: b.diaSemana,
      inicio: minutos(b.horaInicio),
      fin: minutos(b.horaFin),
    })),
  };
}

export type Horario = Awaited<ReturnType<typeof cargarHorario>>;

export async function existentes(
  idUsuario: number,
  desde: string,
  hasta: string,
  db: Tx = prisma,
): Promise<VentanaExistente[]> {
  const filas = await db.microVentana.findMany({
    where: { idUsuario, fecha: { gte: parseFecha(desde), lte: parseFecha(hasta) } },
    include: {
      microPausa: { select: { estado: true, actividad: { select: { duracionMin: true } } } },
    },
  });
  return filas.map((v) => ({
    idVentana: v.idVentana,
    fecha: formatFecha(v.fecha),
    horaInicio: formatHHmm(v.horaInicio),
    duracionMin: v.duracionMin,
    pausa: v.microPausa && {
      estado: v.microPausa.estado,
      duracionActividad: v.microPausa.actividad.duracionMin,
    },
  }));
}

const aFila = (idUsuario: number, v: VentanaCalculada) => ({
  idUsuario,
  fecha: parseFecha(v.fecha),
  horaInicio: parseHHmm(v.horaInicio),
  duracionMin: v.duracionMin,
});

// Se ejecuta dentro de la transacción con bloqueo (conBloqueo).
export async function aplicar(idUsuario: number, plan: PlanReconciliacion, db: Tx): Promise<void> {
  if (plan.eliminar.length > 0) {
    await db.microVentana.deleteMany({ where: { idUsuario, idVentana: { in: plan.eliminar } } });
  }
  if (plan.crear.length > 0) {
    await db.microVentana.createMany({
      data: plan.crear.map((v) => aFila(idUsuario, v)),
      skipDuplicates: true,
    });
  }
  for (const { idVentana, duracionMin } of plan.actualizarDuracion) {
    await db.microVentana.updateMany({ where: { idVentana, idUsuario }, data: { duracionMin } });
  }
}

const INCLUIR = {
  microPausa: {
    select: {
      idPausa: true,
      estado: true,
      actividad: { select: { idActividad: true, nombre: true, duracionMin: true } },
    },
  },
} satisfies Prisma.MicroVentanaInclude;

function filtroPausa(conPausa?: boolean): Prisma.MicroVentanaWhereInput {
  if (conPausa === undefined) return {};
  return conPausa ? { microPausa: { isNot: null } } : { microPausa: { is: null } };
}

export async function listar(idUsuario: number, filtros: FiltrosVentanas) {
  const where: Prisma.MicroVentanaWhereInput = {
    idUsuario,
    fecha: filtroFechas(filtros.desde, filtros.hasta),
    ...filtroPausa(filtros.conPausa),
  };
  const [filas, total] = await prisma.$transaction([
    prisma.microVentana.findMany({
      where,
      include: INCLUIR,
      orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
      ...aSkipTake(filtros),
    }),
    prisma.microVentana.count({ where }),
  ]);
  return { filas, total };
}

export function buscar(idUsuario: number, idVentana: number) {
  return prisma.microVentana.findFirst({ where: { idVentana, idUsuario }, include: INCLUIR });
}

export async function eliminar(idUsuario: number, idVentana: number): Promise<boolean> {
  const { count } = await prisma.microVentana.deleteMany({ where: { idVentana, idUsuario } });
  return count > 0;
}

export type FilaVentana = NonNullable<Awaited<ReturnType<typeof buscar>>>;
