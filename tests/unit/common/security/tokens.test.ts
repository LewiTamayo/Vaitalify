import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  firmarAccess,
  firmarRefresh,
  hashToken,
  verificarAccess,
  verificarRefresh,
} from '../../../../src/common/security/tokens.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('tokens', () => {
  it('access: ida y vuelta conserva id y rol', async () => {
    const token = await firmarAccess(7, 'admin');
    await expect(verificarAccess(token)).resolves.toEqual({ idUsuario: 7, rol: 'admin' });
  });

  it('no se puede usar un refresh como access ni al revés', async () => {
    const { token: refresh } = await firmarRefresh(7);
    await expect(verificarAccess(refresh)).rejects.toMatchObject({ status: 401 });
    const access = await firmarAccess(7, 'user');
    await expect(verificarRefresh(access)).rejects.toMatchObject({ status: 401 });
  });

  it('rechaza un token con la firma alterada', async () => {
    const token = await firmarAccess(7, 'user');
    const alterado = token.slice(0, -2) + (token.endsWith('AA') ? 'BB' : 'AA');
    await expect(verificarAccess(alterado)).rejects.toMatchObject({ status: 401 });
  });

  it('rechaza un access vencido (TTL 15 min)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-17T10:00:00Z'));
    const token = await firmarAccess(7, 'user');
    vi.setSystemTime(new Date('2026-10-17T10:16:00Z'));
    await expect(verificarAccess(token)).rejects.toMatchObject({ status: 401 });
  });

  it('refresh: tokens únicos, expiración a 7 días y verificación', async () => {
    const a = await firmarRefresh(7);
    const b = await firmarRefresh(7);
    expect(a.token).not.toBe(b.token);
    const sieteDias = Date.now() + 7 * 24 * 3600 * 1000;
    expect(Math.abs(a.expiraEn.getTime() - sieteDias)).toBeLessThan(60_000);
    await expect(verificarRefresh(a.token)).resolves.toEqual({ idUsuario: 7 });
  });

  it('hashToken es SHA-256 en hex', () => {
    expect(hashToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
