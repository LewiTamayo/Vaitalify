import { pathToFileURL } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { pino } from 'pino';
import { PrismaClient, TipoConfigNotificacion } from '../src/generated/prisma/client.js';
import { ACTIVIDADES, INSIGNIAS } from './seed-data.js';

// Seed idempotente: se ejecuta en cada despliegue (vercel-build) y antes de los tests.
// Las contraseñas de los usuarios de ejemplo salen de variables de entorno, nunca del código.

const logger = pino({ level: process.env.APP_ENV === 'test' ? 'silent' : 'info' });

export async function sembrarCatalogo(prisma: PrismaClient): Promise<void> {
  for (const actividad of ACTIVIDADES) {
    const existe = await prisma.actividad.findFirst({ where: { nombre: actividad.nombre } });
    if (!existe) await prisma.actividad.create({ data: actividad });
  }
  for (const insignia of INSIGNIAS) {
    await prisma.insignia.upsert({
      where: { codigo: insignia.codigo },
      update: {
        nombre: insignia.nombre,
        descripcion: insignia.descripcion,
        criterio: insignia.criterio,
      },
      create: insignia,
    });
  }
}

const BLOQUES_DEMO = [1, 2, 3, 4, 5].flatMap((diaSemana) => [
  { diaSemana, tipo: 'estudio' as const, titulo: 'Clases', horaInicio: '07:00', horaFin: '12:00' },
  { diaSemana, tipo: 'trabajo' as const, titulo: 'Trabajo', horaInicio: '14:00', horaFin: '18:00' },
]);

const hora = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00Z`);

async function crearUsuario(
  prisma: PrismaClient,
  datos: { correo: string; nombre: string; rol: 'user' | 'admin'; contrasena: string },
) {
  const existe = await prisma.usuario.findUnique({ where: { correo: datos.correo } });
  if (existe) return null;
  const costo = Number(process.env.BCRYPT_COST ?? 12);
  return prisma.usuario.create({
    data: {
      correo: datos.correo,
      nombre: datos.nombre,
      rol: datos.rol,
      aceptaDatos: true,
      contrasenaHash: await bcrypt.hash(datos.contrasena, costo),
      progreso: { create: {} },
      configs: {
        createMany: { data: Object.values(TipoConfigNotificacion).map((tipo) => ({ tipo })) },
      },
    },
  });
}

export async function sembrarUsuarios(prisma: PrismaClient): Promise<void> {
  const { SEED_ADMIN_PASSWORD: admin, SEED_DEMO_PASSWORD: demo } = process.env;
  if (admin) {
    await crearUsuario(prisma, {
      correo: 'admin@vitalify.dev',
      nombre: 'Administración',
      rol: 'admin',
      contrasena: admin,
    });
  }
  if (!demo) return;
  const usuario = await crearUsuario(prisma, {
    correo: 'demo@vitalify.dev',
    nombre: 'Usuario Demo',
    rol: 'user',
    contrasena: demo,
  });
  if (!usuario) return;
  await prisma.perfilHabitos.create({
    data: {
      idUsuario: usuario.idUsuario,
      horaDormir: hora('22:45'),
      horaDespertar: hora('06:15'),
      metaHorasSueno: 7.5,
      metaMinActividad: 150,
    },
  });
  await prisma.bloqueHorario.createMany({
    data: BLOQUES_DEMO.map((b) => ({
      ...b,
      idUsuario: usuario.idUsuario,
      horaInicio: hora(b.horaInicio),
      horaFin: hora(b.horaFin),
    })),
  });
}

export function crearClienteSeed(url = process.env.DATABASE_URL ?? ''): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

async function main(): Promise<void> {
  const prisma = crearClienteSeed();
  try {
    await sembrarCatalogo(prisma);
    await sembrarUsuarios(prisma);
    logger.info('Seed completado');
  } finally {
    await prisma.$disconnect();
  }
}

// Solo como script (prisma db seed): carga .env aquí y no al importar el módulo, para no
// mezclar variables de desarrollo en el proceso de los tests (que importan sembrarCatalogo).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  (await import('dotenv')).config({ quiet: true });
  await main();
}
