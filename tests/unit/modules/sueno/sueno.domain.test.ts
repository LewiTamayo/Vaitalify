import { describe, expect, it } from 'vitest';
import { calcularPlanSueno } from '../../../../src/modules/sueno/sueno.domain.js';

const PERFIL = { horaDormir: '22:45', horaDespertar: '06:15', metaHorasSueno: 7.5 };

describe('calcularPlanSueno (§7.3)', () => {
  it('ejemplo del mockup: primera actividad 07:00, margen 45, meta 7 h 30 → 22:45', () => {
    const plan = calcularPlanSueno(PERFIL, [{ titulo: 'Clase', horaInicio: '07:00' }], 45);
    expect(plan).toEqual({
      acostarse: '22:45',
      despertar: '06:15',
      horasDeSuenoLogradas: 7.5,
      primeraActividad: { titulo: 'Clase', horaInicio: '07:00' },
      checklist: [
        { texto: 'Deja las pantallas', hora: '22:15' },
        { texto: 'Prepara lo de mañana', hora: '22:00' },
        { texto: 'Última cafeína antes de las 16:00', hora: null },
      ],
    });
  });

  it('sin bloques al día siguiente usa horaDormir y horaDespertar del perfil', () => {
    const plan = calcularPlanSueno({ ...PERFIL, horaDormir: '23:00' }, [], 45);
    expect(plan).toMatchObject({
      acostarse: '23:00',
      despertar: '06:15',
      horasDeSuenoLogradas: 7.3,
      primeraActividad: null,
    });
  });

  it('toma el bloque de menor hora de inicio', () => {
    const plan = calcularPlanSueno(
      PERFIL,
      [
        { titulo: 'Trabajo', horaInicio: '09:00' },
        { titulo: 'Bus', horaInicio: '06:30' },
      ],
      45,
    );
    expect(plan.primeraActividad).toEqual({ titulo: 'Bus', horaInicio: '06:30' });
    expect(plan.acostarse).toBe('22:15');
  });

  it('meta de 9 h con primera actividad 07:00 → 21:15', () => {
    expect(
      calcularPlanSueno(
        { ...PERFIL, metaHorasSueno: 9 },
        [{ titulo: 'x', horaInicio: '07:00' }],
        45,
      ).acostarse,
    ).toBe('21:15');
  });

  it('primera actividad muy temprano: acostarse cruza al día anterior sin valores negativos', () => {
    const plan = calcularPlanSueno(PERFIL, [{ titulo: 'x', horaInicio: '04:00' }], 45);
    expect(plan.despertar).toBe('03:15');
    expect(plan.acostarse).toBe('19:45');
  });

  it('dormirse después de medianoche (00:30) sin bloques', () => {
    const plan = calcularPlanSueno({ ...PERFIL, horaDormir: '00:30' }, [], 45);
    expect(plan.acostarse).toBe('00:30');
    expect(plan.horasDeSuenoLogradas).toBeCloseTo(5.8, 5);
    expect(plan.checklist[0]).toEqual({ texto: 'Deja las pantallas', hora: '00:00' });
  });
});
