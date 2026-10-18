import { describe, expect, it } from 'vitest';
import { hoyLogico } from './fechas';

// Bogotá es UTC−5 todo el año: 08:59Z = 03:59 locales.
describe('hoyLogico()', () => {
  it('antes de las 04:00 locales sigue siendo el día anterior', () => {
    expect(hoyLogico(new Date('2026-10-18T08:59:00Z'))).toBe('2026-10-17');
  });

  it('desde las 04:00 locales ya es el día nuevo', () => {
    expect(hoyLogico(new Date('2026-10-18T09:00:00Z'))).toBe('2026-10-18');
  });

  it('usa la fecha de Bogotá aunque en UTC ya sea el día siguiente', () => {
    expect(hoyLogico(new Date('2026-11-01T03:30:00Z'))).toBe('2026-10-31');
  });

  it('el corte cruza el cambio de mes', () => {
    expect(hoyLogico(new Date('2026-11-01T06:00:00Z'))).toBe('2026-10-31');
  });
});
