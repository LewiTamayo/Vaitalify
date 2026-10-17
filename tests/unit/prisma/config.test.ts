import { describe, expect, it } from 'vitest';
import { urlMigraciones } from '../../../prisma.config.js';

describe('urlMigraciones', () => {
  it('prefiere DIRECT_URL y luego DATABASE_URL_UNPOOLED', () => {
    expect(urlMigraciones({ DIRECT_URL: 'd', DATABASE_URL_UNPOOLED: 'u', DATABASE_URL: 'p' })).toBe(
      'd',
    );
    expect(urlMigraciones({ DATABASE_URL_UNPOOLED: 'u', DATABASE_URL: 'p' })).toBe('u');
  });

  it('fuera de Vercel acepta DATABASE_URL como último recurso', () => {
    expect(urlMigraciones({ DATABASE_URL: 'p' })).toBe('p');
  });

  it('en un build de Vercel exige una URL sin pooling', () => {
    expect(() => urlMigraciones({ VERCEL: '1', DATABASE_URL: 'p' })).toThrow(/DIRECT_URL/);
  });
});
