import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../../config/env.js';
import { PrismaClient } from '../../generated/prisma/client.js';

export { Prisma } from '../../generated/prisma/client.js';
export * from '../../generated/prisma/enums.js';

const TIMEOUT_CONEXION_MS = 5000;

// El timeout de conexión evita que una consulta quede colgada hasta el límite de Vercel
// si Neon no responde (spec §17.2: ninguna petición debe superar 10 s).
export function crearCliente(
  connectionString: string,
  connectionTimeoutMillis = TIMEOUT_CONEXION_MS,
  max = env.DB_POOL_MAX,
): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString, connectionTimeoutMillis, max }),
  });
}

// Un solo PrismaClient por instancia: se reutiliza entre invocaciones de la función de Vercel.
// En desarrollo se guarda en globalThis para sobrevivir a las recargas de `tsx watch`.
const globalParaPrisma = globalThis as unknown as { __prisma?: PrismaClient };

export const prisma: PrismaClient = globalParaPrisma.__prisma ?? crearCliente(env.DATABASE_URL);

if (env.APP_ENV !== 'production') {
  globalParaPrisma.__prisma = prisma;
}
