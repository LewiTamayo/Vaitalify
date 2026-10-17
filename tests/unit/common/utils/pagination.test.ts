import { describe, expect, it } from 'vitest';
import { PaginacionSchema, aSkipTake, pagina } from '../../../../src/common/utils/pagination.js';

describe('paginación', () => {
  it('aplica los valores por defecto', () => {
    expect(PaginacionSchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(PaginacionSchema.parse({ page: '3', pageSize: '50' })).toEqual({
      page: 3,
      pageSize: 50,
    });
  });

  it.each([{ pageSize: '101' }, { pageSize: '0' }, { page: '0' }, { page: 'x' }])(
    'rechaza %o',
    (entrada) => {
      expect(PaginacionSchema.safeParse(entrada).success).toBe(false);
    },
  );

  it('convierte a skip/take y arma la página', () => {
    expect(aSkipTake({ page: 3, pageSize: 20 })).toEqual({ skip: 40, take: 20 });
    expect(pagina([1, 2], 57, { page: 1, pageSize: 2 })).toEqual({
      data: [1, 2],
      meta: { page: 1, pageSize: 2, total: 57 },
    });
  });
});
