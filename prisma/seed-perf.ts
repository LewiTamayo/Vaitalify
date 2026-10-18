// Seed de rendimiento (spec §19.3): `npm run db:seed:perf` sobre la rama `perf` de Neon.
// Idempotente: repetirlo actualiza la contraseña y completa lo que falte, sin duplicar.
import '../scripts/entorno-perf.js';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { actividadQueCabe, correoPerf, horarioPerf, lineasCsv } from './seed-perf-datos.js';

const { env } = await import('../src/config/env.js');
const { logger } = await import('../src/common/logger.js');
const { prisma, TipoConfigNotificacion } = await import('../src/common/db/prisma.js');
const { hashContrasena } = await import('../src/common/security/passwords.js');
const { hoyEnZona, parseFecha } = await import('../src/common/utils/dates.js');
const ventanas = await import('../src/modules/micro-ventanas/micro-ventanas.service.js');

const RUTA_CSV = 'tests/performance/data/usuarios.csv';
// Por debajo del pool de pg (10 conexiones) para no agotar conexiones en Neon.
const CONCURRENCIA = 5;
const hora = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00Z`);

async function asegurarUsuario(i: number, contrasenaHash: string): Promise<number> {
  const correo = correoPerf(i);
  const usuario = await prisma.usuario.upsert({
    where: { correo },
    update: { contrasenaHash },
    create: {
      correo,
      nombre: `Perf ${i}`,
      aceptaDatos: true,
      contrasenaHash,
      progreso: { create: {} },
      configs: {
        createMany: { data: Object.values(TipoConfigNotificacion).map((tipo) => ({ tipo })) },
      },
    },
  });
  const { idUsuario } = usuario;
  const perfil = {
    horaDormir: hora('22:45'),
    horaDespertar: hora('06:15'),
    metaHorasSueno: 7.5,
    metaMinActividad: 150,
  };
  await prisma.perfilHabitos.upsert({
    where: { idUsuario },
    update: {},
    create: { idUsuario, ...perfil },
  });
  if ((await prisma.bloqueHorario.count({ where: { idUsuario } })) === 0) {
    await prisma.bloqueHorario.createMany({
      data: horarioPerf(i).map((b) => ({
        ...b,
        idUsuario,
        horaInicio: hora(b.horaInicio),
        horaFin: hora(b.horaFin),
      })),
    });
  }
  return idUsuario;
}

// Ventanas de hoy a +6 días (algoritmo real, §7.1) y una pausa pendiente en cada ventana que no
// la tenga. Las pausas se insertan en bloque con la actividad que mejor cabe: el servicio
// `recomendar` además regenera recordatorios, que estas pruebas no necesitan.
async function prepararSemana(
  idUsuario: number,
  actividades: ReadonlyArray<{ idActividad: number; duracionMin: number }>,
): Promise<void> {
  await ventanas.recalcularSemana(idUsuario);
  const libres = await prisma.microVentana.findMany({
    where: { idUsuario, microPausa: null, fecha: { gte: parseFecha(hoyEnZona()) } },
    select: { idVentana: true, duracionMin: true },
  });
  const data = libres.flatMap(({ idVentana, duracionMin }) => {
    const idActividad = actividadQueCabe(actividades, duracionMin);
    return idActividad === null ? [] : [{ idVentana, idActividad }];
  });
  await prisma.microPausa.createMany({ data, skipDuplicates: true });
}

async function sembrarPerf(cantidad: number, contrasena: string): Promise<void> {
  const contrasenaHash = await hashContrasena(contrasena);
  const actividades = await prisma.actividad.findMany({
    select: { idActividad: true, duracionMin: true },
  });
  const indices = Array.from({ length: cantidad }, (_, k) => k + 1);
  for (let desde = 0; desde < indices.length; desde += CONCURRENCIA) {
    await Promise.all(
      indices.slice(desde, desde + CONCURRENCIA).map(async (i) => {
        await prepararSemana(await asegurarUsuario(i, contrasenaHash), actividades);
      }),
    );
    logger.info(`Usuarios perf listos: ${Math.min(desde + CONCURRENCIA, cantidad)}/${cantidad}`);
  }
  await mkdir(dirname(RUTA_CSV), { recursive: true });
  await writeFile(RUTA_CSV, lineasCsv(indices.map(correoPerf), contrasena));
  logger.info(`CSV de JMeter: ${RUTA_CSV}`);
}

try {
  // Sin PERF_USER_PASSWORD se genera una aleatoria; solo queda en el CSV (ignorado por git).
  const contrasena = env.PERF_USER_PASSWORD ?? randomBytes(12).toString('base64url');
  await sembrarPerf(env.PERF_USERS, contrasena);
} finally {
  await prisma.$disconnect();
}
