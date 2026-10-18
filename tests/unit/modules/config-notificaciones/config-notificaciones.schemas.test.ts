import { describe, expect, it } from 'vitest';
import { ConfigSchema } from '../../../../src/modules/config-notificaciones/config-notificaciones.schemas.js';

describe('ConfigSchema', () => {
  it('acepta sin silencio y con silencio que cruza medianoche', () => {
    expect(
      ConfigSchema.safeParse({ activa: true, silencioInicio: null, silencioFin: null }).success,
    ).toBe(true);
    expect(
      ConfigSchema.safeParse({ activa: false, silencioInicio: '22:00', silencioFin: '07:00' })
        .success,
    ).toBe(true);
  });

  it.each([
    ['solo inicio', { silencioInicio: '22:00', silencioFin: null }],
    ['solo fin', { silencioInicio: null, silencioFin: '07:00' }],
    ['inicio igual a fin', { silencioInicio: '22:00', silencioFin: '22:00' }],
    ['hora inválida', { silencioInicio: '25:00', silencioFin: '07:00' }],
  ])('rechaza %s', (_caso, cambio) => {
    expect(ConfigSchema.safeParse({ activa: true, ...cambio }).success).toBe(false);
  });
});
