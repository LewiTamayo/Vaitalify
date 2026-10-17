import 'dotenv/config';
import { defineConfig } from 'prisma/config';

type Entorno = Record<string, string | undefined>;

// Las migraciones usan la URL SIN pooling (DIRECT_URL, o DATABASE_URL_UNPOOLED de Neon Marketplace):
// `migrate deploy` a través de PgBouncer puede fallar. En un build de Vercel no se admite otra.
export function urlMigraciones(entorno: Entorno): string {
  const directa = entorno.DIRECT_URL ?? entorno.DATABASE_URL_UNPOOLED;
  if (directa) return directa;
  if (entorno.VERCEL) {
    throw new Error('Falta DIRECT_URL o DATABASE_URL_UNPOOLED para ejecutar las migraciones');
  }
  return entorno.DATABASE_URL ?? '';
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: urlMigraciones(process.env),
  },
});
