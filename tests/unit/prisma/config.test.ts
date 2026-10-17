import { describe, expect, it } from 'vitest';
import { exigirUrlMigraciones, urlMigraciones } from '../../../prisma.config.js';

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

  it('en Vercel nunca usa la URL con pooling, pero no lanza (prisma generate carga esta config)', () => {
    expect(urlMigraciones({ VERCEL: '1', DATABASE_URL: 'p' })).toBe('');
    expect(urlMigraciones({ VERCEL: '1' })).toBe('');
  });
});

describe('exigirUrlMigraciones (antes de migrate deploy en vercel-build)', () => {
  it('lanza con un mensaje claro si falta la URL directa', () => {
    expect(() => exigirUrlMigraciones({ VERCEL: '1', DATABASE_URL: 'p' })).toThrow(
      /DIRECT_URL o DATABASE_URL_UNPOOLED/,
    );
  });

  it('no lanza si hay URL directa', () => {
    expect(() => exigirUrlMigraciones({ VERCEL: '1', DATABASE_URL_UNPOOLED: 'u' })).not.toThrow();
  });
});
