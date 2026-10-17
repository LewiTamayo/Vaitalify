import { describe, expect, it } from 'vitest';
import { Prisma } from '../../../../src/common/db/prisma.js';
import { parseFecha } from '../../../../src/common/utils/dates.js';
import { parseHHmm } from '../../../../src/common/utils/time.js';
import { construirExportacion } from '../../../../src/modules/usuarios/usuarios.export.js';
import type { UsuarioConRelaciones } from '../../../../src/modules/usuarios/usuarios.repository.js';

const fixture = {
  idUsuario: 7,
  nombre: 'Ana',
  correo: 'ana@correo.com',
  contrasenaHash: '$2a$10$secreto',
  fechaRegistro: new Date('2026-10-01T15:00:00Z'),
  aceptaDatos: true,
  rol: 'user',
  perfil: {
    idPerfil: 1,
    idUsuario: 7,
    horaDormir: parseHHmm('22:45'),
    horaDespertar: parseHHmm('06:15'),
    metaHorasSueno: new Prisma.Decimal(7.5),
    metaMinActividad: 150,
  },
  bloques: [
    {
      idBloque: 3,
      idUsuario: 7,
      tipo: 'estudio',
      titulo: 'Clase de Cálculo',
      diaSemana: 2,
      horaInicio: parseHHmm('07:00'),
      horaFin: parseHHmm('09:00'),
      origen: 'manual',
    },
  ],
  microVentanas: [],
  registrosSueno: [
    {
      idRegistro: 4,
      idUsuario: 7,
      fecha: parseFecha('2026-10-05'),
      horasDormidas: new Prisma.Decimal(6.5),
    },
  ],
  recordatorios: [],
  configs: [
    {
      idConfig: 1,
      idUsuario: 7,
      tipo: 'sueno',
      activa: true,
      silencioInicio: parseHHmm('22:00'),
      silencioFin: parseHHmm('07:00'),
    },
  ],
  progreso: {
    idProgreso: 1,
    idUsuario: 7,
    puntosTotales: 30,
    rachaActual: 2,
    rachaMaxima: 5,
    diasComodin: 1,
    ultimaFechaActiva: parseFecha('2026-10-06'),
    semanaComodin: '2026-W41',
  },
  insignias: [],
} as unknown as UsuarioConRelaciones;

describe('construirExportacion', () => {
  const resultado = construirExportacion(fixture, new Date('2026-10-17T12:00:00Z'));

  it('expone horas HH:mm, fechas YYYY-MM-DD y decimales como número', () => {
    expect(resultado.generadoEn).toBe('2026-10-17T12:00:00.000Z');
    expect(resultado.perfil).toMatchObject({
      horaDormir: '22:45',
      horaDespertar: '06:15',
      metaHorasSueno: 7.5,
    });
    expect(resultado.bloques[0]).toMatchObject({ horaInicio: '07:00', horaFin: '09:00' });
    expect(resultado.registrosSueno[0]).toMatchObject({ fecha: '2026-10-05', horasDormidas: 6.5 });
    expect(resultado.configNotificaciones[0]).toMatchObject({
      silencioInicio: '22:00',
      silencioFin: '07:00',
    });
    expect(resultado.progreso).toMatchObject({
      ultimaFechaActiva: '2026-10-06',
      puntosTotales: 30,
    });
  });

  it('no incluye el hash de la contraseña ni tokens', () => {
    const texto = JSON.stringify(resultado);
    expect(texto).not.toMatch(/contrasenaHash|tokenHash|\$2a\$/);
    expect(resultado.usuario.correo).toBe('ana@correo.com');
  });
});
