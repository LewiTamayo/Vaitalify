import { describe, expect, it } from 'vitest';
import { hoyEnZona } from './fechas';

// Bogotá es UTC−5 todo el año. Igual que hoyEnZona() de la API (sin corte de las 04:00,
// que solo usan los recordatorios): /micro-pausas/hoy y la pantalla deben coincidir.
describe('hoyEnZona()', () => {
  it('después de medianoche en Bogotá ya es el día nuevo', () => {
    expect(hoyEnZona(new Date('2026-10-18T05:30:00Z'))).toBe('2026-10-18');
  });

  it('antes de medianoche en Bogotá sigue siendo el día anterior', () => {
    expect(hoyEnZona(new Date('2026-10-18T04:59:00Z'))).toBe('2026-10-17');
  });

  it('usa la fecha de Bogotá aunque en UTC ya sea el día siguiente, también al cambiar de mes', () => {
    expect(hoyEnZona(new Date('2026-11-01T03:30:00Z'))).toBe('2026-10-31');
  });
});
