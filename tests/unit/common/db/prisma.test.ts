import { createServer, type Server } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearCliente } from '../../../../src/common/db/prisma.js';

// Servidor TCP que acepta conexiones y nunca responde (como una BD inalcanzable o colgada).
// Cuenta cuántas conexiones tiene abiertas a la vez, para comprobar el tamaño del pool.
interface Colgado {
  servidor: Server;
  puerto: number;
  maxAbiertas: () => number;
}

async function servidorColgado(): Promise<Colgado> {
  let abiertas = 0;
  let max = 0;
  const servidor = createServer((socket) => {
    abiertas++;
    max = Math.max(max, abiertas);
    socket.on('close', () => abiertas--);
  });
  await new Promise<void>((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  const direccion = servidor.address();
  const puerto = typeof direccion === 'object' && direccion ? direccion.port : 0;
  return { servidor, puerto, maxAbiertas: () => max };
}

let colgado: Colgado;
let puerto = 0;

beforeAll(async () => {
  colgado = await servidorColgado();
  puerto = colgado.puerto;
});

afterAll(() => {
  colgado.servidor.close();
});

describe('crearCliente', () => {
  it('una consulta contra una BD que no responde falla al vencer el timeout de conexión', async () => {
    const cliente = crearCliente(`postgresql://u:p@127.0.0.1:${puerto}/db`, 300);
    const inicio = Date.now();
    await expect(cliente.$queryRaw`SELECT 1`).rejects.toThrow();
    expect(Date.now() - inicio).toBeLessThan(3000);
    await cliente.$disconnect();
  }, 10_000);

  it('no abre más conexiones simultáneas que el máximo del pool', async () => {
    const propio = await servidorColgado();
    const cliente = crearCliente(`postgresql://u:p@127.0.0.1:${propio.puerto}/db`, 500, 2);
    const consultas = Array.from({ length: 6 }, () =>
      cliente.$queryRaw`SELECT 1`.catch(() => null),
    );
    await Promise.all(consultas);
    expect(propio.maxAbiertas()).toBe(2);
    await cliente.$disconnect();
    propio.servidor.close();
  }, 15_000);
});
