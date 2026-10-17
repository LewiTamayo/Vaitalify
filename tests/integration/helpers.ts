import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/common/db/prisma.js';

// Cada archivo de test tiene su propia instancia de este módulo: solo borra lo que creó.
const correosCreados: string[] = [];

export const CONTRASENA = 'secreta123';

export function crearAppTest(): Express {
  return createApp({
    fabricaLimitador: () => ({
      consumir: () => Promise.resolve({ permitido: true, restantes: 99, reinicioMs: 0 }),
    }),
  });
}

export function correoUnico(): string {
  const correo = `${randomUUID()}@test.vitalify.dev`;
  correosCreados.push(correo);
  return correo;
}

export interface SesionTest {
  usuario: { idUsuario: number; correo: string; nombre: string; rol: string };
  accessToken: string;
  refreshToken: string;
  correo: string;
}

export async function registrar(app: Express, correo = correoUnico()): Promise<SesionTest> {
  const res = await request(app)
    .post('/api/v1/auth/registro')
    .send({ nombre: 'Ana Prueba', correo, contrasena: CONTRASENA, aceptaDatos: true });
  if (res.status !== 201) {
    throw new Error(`Registro de prueba falló: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { ...(res.body as Omit<SesionTest, 'correo'>), correo };
}

export function bearer(sesion: SesionTest): [string, string] {
  return ['authorization', `Bearer ${sesion.accessToken}`];
}

export async function limpiarUsuariosDeTest(): Promise<void> {
  await prisma.usuario.deleteMany({ where: { correo: { in: correosCreados } } });
  await prisma.$disconnect();
}
