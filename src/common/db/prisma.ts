import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../../config/env.js';
import { PrismaClient } from '../../generated/prisma/client.js';

export { Prisma } from '../../generated/prisma/client.js';
export * from '../../generated/prisma/enums.js';

// Un solo PrismaClient por instancia: se reutiliza entre invocaciones de la función de Vercel.
// En desarrollo se guarda en globalThis para sobrevivir a las recargas de `tsx watch`.
const globalParaPrisma = globalThis as unknown as { __prisma?: PrismaClient };

function crearCliente(): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
}

export const prisma: PrismaClient = globalParaPrisma.__prisma ?? crearCliente();

if (env.APP_ENV !== 'production') {
  globalParaPrisma.__prisma = prisma;
}
