import { describe, expect, it } from 'vitest';
import { aMinutos, deMinutos, formatHHmm, parseHHmm } from '../../../../src/common/utils/time.js';

describe('time', () => {
  it('ida y vuelta HH:mm', () => {
    expect(formatHHmm(parseHHmm('22:45'))).toBe('22:45');
    expect(parseHHmm('07:05').toISOString()).toBe('1970-01-01T07:05:00.000Z');
  });

  it('convierte a minutos desde medianoche', () => {
    expect(aMinutos('07:00')).toBe(420);
    expect(aMinutos('00:00')).toBe(0);
  });

  it('reproduce el ejemplo del mockup 07:00 → 22:45 (§7.3)', () => {
    expect(deMinutos(420 - 45 - 450)).toBe('22:45');
  });

  it('normaliza minutos negativos o mayores a un día', () => {
    expect(deMinutos(-15)).toBe('23:45');
    expect(deMinutos(1440 + 30)).toBe('00:30');
  });

  it('rechaza horas inválidas', () => {
    expect(() => parseHHmm('24:00')).toThrow();
    expect(() => parseHHmm('7:00')).toThrow();
    expect(() => aMinutos('12:60')).toThrow();
  });
});
