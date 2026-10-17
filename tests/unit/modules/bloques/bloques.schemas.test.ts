import { describe, expect, it } from 'vitest';
import {
  BloqueParcialSchema,
  BloqueSchema,
  FiltrosBloquesSchema,
} from '../../../../src/modules/bloques/bloques.schemas.js';

const valido = {
  tipo: 'estudio',
  titulo: 'Clase de Cálculo',
  diaSemana: 2,
  horaInicio: '07:00',
  horaFin: '09:00',
};

describe('BloqueSchema', () => {
  it('acepta un bloque válido y recorta el título', () => {
    expect(BloqueSchema.parse({ ...valido, titulo: '  Clase  ' }).titulo).toBe('Clase');
  });

  it.each([
    ['horaFin igual a horaInicio', { horaFin: '07:00' }],
    ['horaFin antes de horaInicio', { horaFin: '06:00' }],
    ['horaFin 24:00', { horaFin: '24:00' }],
    ['diaSemana 0', { diaSemana: 0 }],
    ['diaSemana 8', { diaSemana: 8 }],
    ['tipo desconocido', { tipo: 'ocio' }],
    ['título vacío', { titulo: '   ' }],
    ['título de 81 caracteres', { titulo: 'x'.repeat(81) }],
    ['campo desconocido', { origen: 'importado' }],
  ])('rechaza %s', (_caso, cambio) => {
    expect(BloqueSchema.safeParse({ ...valido, ...cambio }).success).toBe(false);
  });

  it('el error de orden de horas apunta a horaFin', () => {
    const r = BloqueSchema.safeParse({ ...valido, horaFin: '06:00' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['horaFin']);
  });
});

describe('BloqueParcialSchema y filtros', () => {
  it('parcial exige al menos un campo', () => {
    expect(BloqueParcialSchema.safeParse({ titulo: 'Nuevo' }).success).toBe(true);
    expect(BloqueParcialSchema.safeParse({}).success).toBe(false);
  });

  it('filtros: convierte diaSemana y valida tipo y pageSize', () => {
    expect(FiltrosBloquesSchema.parse({ diaSemana: '2', tipo: 'estudio' })).toMatchObject({
      diaSemana: 2,
      tipo: 'estudio',
      page: 1,
      pageSize: 20,
    });
    expect(FiltrosBloquesSchema.safeParse({ tipo: 'ocio' }).success).toBe(false);
    expect(FiltrosBloquesSchema.safeParse({ pageSize: '101' }).success).toBe(false);
  });
});
