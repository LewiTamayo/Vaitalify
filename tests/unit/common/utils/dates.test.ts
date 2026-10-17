import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import {
  diasEntre,
  formatFecha,
  hoyEnZona,
  isoWeekday,
  parseFecha,
  rangoFechas,
  semanaIso,
  sumarDias,
} from '../../../../src/common/utils/dates.js';

describe('dates', () => {
  it('hoyEnZona usa Bogotá aunque UTC ya sea el día siguiente', () => {
    const ahora = DateTime.fromISO('2026-10-18T01:00:00Z');
    expect(hoyEnZona('America/Bogota', ahora)).toBe('2026-10-17');
  });

  it('isoWeekday: 1=lunes … 7=domingo', () => {
    expect(isoWeekday('2026-10-19')).toBe(1);
    expect(isoWeekday('2026-10-18')).toBe(7);
  });

  it('semanaIso', () => {
    expect(semanaIso('2026-10-05')).toBe('2026-W41');
    expect(semanaIso('2026-01-01')).toBe('2026-W01');
  });

  it('diasEntre y sumarDias', () => {
    expect(diasEntre('2026-10-10', '2026-10-13')).toBe(3);
    expect(diasEntre('2026-10-13', '2026-10-10')).toBe(-3);
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('rangoFechas es inclusivo y cruza meses', () => {
    expect(rangoFechas('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
    expect(rangoFechas('2026-11-02', '2026-10-30')).toEqual([]);
  });

  it('parseFecha/formatFecha ida y vuelta en UTC', () => {
    expect(formatFecha(parseFecha('2026-02-28'))).toBe('2026-02-28');
    expect(parseFecha('2026-02-28').toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(() => parseFecha('2026-02-30')).toThrow();
  });
});
