import { describe, expect, it } from 'vitest';
import {
  ActividadSchema,
  FiltrosActividadesSchema,
} from '../../../../src/modules/actividades/actividades.schemas.js';

const valida = {
  nombre: 'Caminata corta',
  categoria: 'caminata',
  duracionMin: 10,
  instrucciones: '1. Ponte de pie.\n2. Camina.',
};

describe('ActividadSchema', () => {
  it('acepta una actividad válida', () => {
    expect(ActividadSchema.safeParse(valida).success).toBe(true);
  });

  it.each([
    ['duracionMin 0', { duracionMin: 0 }],
    ['duracionMin 16', { duracionMin: 16 }],
    ['duracionMin decimal', { duracionMin: 5.5 }],
    ['categoría inválida', { categoria: 'yoga' }],
    ['nombre vacío', { nombre: ' ' }],
    ['instrucciones vacías', { instrucciones: '' }],
  ])('rechaza %s', (_caso, cambio) => {
    expect(ActividadSchema.safeParse({ ...valida, ...cambio }).success).toBe(false);
  });

  it('filtros: convierte maxDuracionMin y valida la categoría', () => {
    expect(FiltrosActividadesSchema.parse({ maxDuracionMin: '10' })).toMatchObject({
      maxDuracionMin: 10,
    });
    expect(FiltrosActividadesSchema.safeParse({ categoria: 'yoga' }).success).toBe(false);
  });
});
