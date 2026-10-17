import { describe, expect, it } from 'vitest';
import {
  PerfilParcialSchema,
  PerfilSchema,
} from '../../../../src/modules/perfil/perfil.schemas.js';

const valido = {
  horaDormir: '22:45',
  horaDespertar: '06:15',
  metaHorasSueno: 7.5,
  metaMinActividad: 150,
};

describe('PerfilSchema', () => {
  it('acepta un perfil válido', () => {
    expect(PerfilSchema.safeParse(valido).success).toBe(true);
  });

  it.each([
    ['metaHorasSueno 7.3 (no múltiplo de 0.5)', { metaHorasSueno: 7.3 }],
    ['metaHorasSueno 7.25', { metaHorasSueno: 7.25 }],
    ['metaHorasSueno 3.5 (< 4)', { metaHorasSueno: 3.5 }],
    ['metaHorasSueno 12.5 (> 12)', { metaHorasSueno: 12.5 }],
    ['metaMinActividad 1501', { metaMinActividad: 1501 }],
    ['metaMinActividad -1', { metaMinActividad: -1 }],
    ['metaMinActividad 10.5', { metaMinActividad: 10.5 }],
    ['horaDormir 25:00', { horaDormir: '25:00' }],
    ['horaDormir igual a horaDespertar', { horaDormir: '06:15' }],
    ['campo desconocido', { extra: 1 }],
  ])('rechaza %s', (_caso, cambio) => {
    expect(PerfilSchema.safeParse({ ...valido, ...cambio }).success).toBe(false);
  });
});

describe('PerfilParcialSchema', () => {
  it('acepta un solo campo y rechaza el cuerpo vacío', () => {
    expect(PerfilParcialSchema.safeParse({ metaHorasSueno: 8 }).success).toBe(true);
    expect(PerfilParcialSchema.safeParse({}).success).toBe(false);
  });
});
