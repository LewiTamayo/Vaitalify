import { createServer, type Server, type Socket } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { crearCliente } from '../../../../src/common/db/prisma.js';

// Servidor TCP que acepta conexiones y nunca responde (como una BD inalcanzable o colgada).
// Cuenta cuántas conexiones tiene abiertas a la vez, para comprobar el tamaño del pool.
interface Colgado {
  servidor: Server;
  puerto: number;
  abiertas: () => number;
  maxAbiertas: () => number;
  cerrar: () => void;
}

async function servidorColgado(): Promise<Colgado> {
  let abiertas = 0;
  let max = 0;
  const sockets = new Set<Socket>();
  const servidor = createServer((socket) => {
    abiertas++;
    max = Math.max(max, abiertas);
    sockets.add(socket);
    socket.on('close', () => {
      abiertas--;
      sockets.delete(socket);
    });
  });
  await new Promise<void>((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  const direccion = servidor.address();
  const puerto = typeof direccion === 'object' && direccion ? direccion.port : 0;
  // Deja de aceptar y corta lo abierto: las consultas pendientes fallan al instante.
  const cerrar = () => {
    servidor.close();
    for (const socket of sockets) socket.destroy();
  };
  return { servidor, puerto, abiertas: () => abiertas, maxAbiertas: () => max, cerrar };
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
    // Timeout largo: ninguna conexión vence durante la medición, así el pool no recicla cupos
    // (un socket vencido aún cerrándose junto al siguiente contaba 3 en el runner de CI).
    const cliente = crearCliente(`postgresql://u:p@127.0.0.1:${propio.puerto}/db`, 10_000, 2);
    const consultas = Array.from({ length: 6 }, () =>
      cliente.$queryRaw`SELECT 1`.catch(() => null),
    );
    await vi.waitFor(() => expect(propio.abiertas()).toBe(2));
    // Margen para que una tercera conexión, si el pool la intentara, alcance a llegar.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(propio.maxAbiertas()).toBe(2);
    propio.cerrar();
    await Promise.all(consultas);
    await cliente.$disconnect();
  }, 15_000);
});
