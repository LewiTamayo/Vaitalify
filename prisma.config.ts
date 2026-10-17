import 'dotenv/config';
import { defineConfig } from 'prisma/config';

type Entorno = Record<string, string | undefined>;

// Las migraciones usan la URL SIN pooling (DIRECT_URL, o DATABASE_URL_UNPOOLED de Neon Marketplace):
// `migrate deploy` a través de PgBouncer puede fallar. En Vercel nunca se usa la URL con pooling.
// No lanza: `prisma generate` (postinstall) también carga esta configuración y no necesita BD.
export function urlMigraciones(entorno: Entorno): string {
  const directa = entorno.DIRECT_URL ?? entorno.DATABASE_URL_UNPOOLED;
  if (directa) return directa;
  return entorno.VERCEL ? '' : (entorno.DATABASE_URL ?? '');
}

// Se ejecuta en vercel-build justo antes de `prisma migrate deploy`.
export function exigirUrlMigraciones(entorno: Entorno): void {
  if (!urlMigraciones(entorno)) {
    throw new Error(
      'Falta DIRECT_URL o DATABASE_URL_UNPOOLED para ejecutar las migraciones. ' +
        'Conecta Neon al proyecto de Vercel para este entorno (Production/Preview).',
    );
  }
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
