import { createServer, type Server } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearCliente } from '../../../../src/common/db/prisma.js';

// Servidor TCP que acepta conexiones y nunca responde (como una BD inalcanzable o colgada).
let servidor: Server;
let puerto = 0;

beforeAll(async () => {
  servidor = createServer(() => undefined);
  await new Promise<void>((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  const direccion = servidor.address();
  puerto = typeof direccion === 'object' && direccion ? direccion.port : 0;
});

afterAll(() => {
  servidor.close();
});

describe('crearCliente', () => {
  it('una consulta contra una BD que no responde falla al vencer el timeout de conexión', async () => {
    const cliente = crearCliente(`postgresql://u:p@127.0.0.1:${puerto}/db`, 300);
    const inicio = Date.now();
    await expect(cliente.$queryRaw`SELECT 1`).rejects.toThrow();
    expect(Date.now() - inicio).toBeLessThan(3000);
    await cliente.$disconnect();
  }, 10_000);
});
