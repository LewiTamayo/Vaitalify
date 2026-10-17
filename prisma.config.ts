import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Las migraciones usan la URL SIN pooling (DIRECT_URL, o DATABASE_URL_UNPOOLED de Neon Marketplace).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '',
  },
});
