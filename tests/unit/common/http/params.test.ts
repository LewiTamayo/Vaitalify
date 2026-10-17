import { describe, expect, it } from 'vitest';
import { IdParamSchema } from '../../../../src/common/http/params.js';

describe('IdParamSchema', () => {
  it('acepta enteros positivos dentro del rango INT de PostgreSQL', () => {
    expect(IdParamSchema.parse({ id: '7' })).toEqual({ id: 7 });
    expect(IdParamSchema.parse({ id: '2147483647' })).toEqual({ id: 2147483647 });
  });

  it.each(['abc', '0', '-1', '1.5', '2147483648', '99999999999'])('rechaza %s', (id) => {
    expect(IdParamSchema.safeParse({ id }).success).toBe(false);
  });
});
