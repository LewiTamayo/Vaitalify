import { existsSync } from 'node:fs';
import { config } from 'dotenv';
import { crearClienteSeed, sembrarCatalogo } from '../prisma/seed.js';

// Siembra el catálogo (actividades e insignias) una vez por corrida de tests.
// Si no hay BD (p. ej. solo tests unitarios sin .env.test), no bloquea: los tests de integración
// fallarán por su cuenta con un error claro.
export default async function setup(): Promise<void> {
  // override: .env.test manda sobre cualquier valor previo (nunca sembrar la BD de desarrollo).
  if (existsSync('.env.test')) config({ path: '.env.test', quiet: true, override: true });
  if (!process.env.DATABASE_URL) return;
  const prisma = crearClienteSeed(process.env.DATABASE_URL);
  try {
    await sembrarCatalogo(prisma);
  } catch {
    // Sin conexión a la BD: los tests unitarios siguen corriendo.
  } finally {
    await prisma.$disconnect();
  }
}
