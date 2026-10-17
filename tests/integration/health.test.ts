import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import app from '../../src/app.js';
import { prisma } from '../../src/common/db/prisma.js';

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/v1/health (PostgreSQL real)', () => {
  it('responde ok/up con la base de datos migrada', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'up' });
  });

  it('la migración inicial creó las tablas del modelo ER', async () => {
    const filas = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    const tablas = filas.map((f) => f.table_name);
    for (const tabla of ['usuario', 'perfil_habitos', 'micro_pausa', 'usuario_insignia']) {
      expect(tablas).toContain(tabla);
    }
  });
});
