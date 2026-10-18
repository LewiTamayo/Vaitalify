import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BASE, json, llamada, mockFetch, problema, sesionDePrueba, vacio } from '../test/http';
import { api, ErrorApi } from './cliente';
import { alExpirarSesion, guardarSesion, tokenAcceso, tokenRefresh } from './tokens';

describe('api()', () => {
  beforeEach(() => guardarSesion(sesionDePrueba(1)));

  it('envía JSON con el token de acceso y devuelve el cuerpo', async () => {
    const fetchMock = mockFetch(json(200, { ok: true }));
    await expect(api('/progreso')).resolves.toEqual({ ok: true });
    expect(llamada(fetchMock, 0).url).toBe(`${BASE}/progreso`);
    expect(llamada(fetchMock, 0).headers.get('Authorization')).toBe('Bearer acceso-1');
  });

  it('serializa el cuerpo y devuelve undefined en 204', async () => {
    const fetchMock = mockFetch(vacio());
    await expect(api('/x', { metodo: 'POST', cuerpo: { a: 1 } })).resolves.toBeUndefined();
    const { init, headers } = llamada(fetchMock, 0);
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"a":1}');
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('convierte un problema RFC 7807 en ErrorApi con los errores por campo', async () => {
    mockFetch(
      problema(400, {
        detail: 'Revisa',
        errors: [{ campo: 'correo', mensaje: 'Correo inválido' }],
      }),
    );
    const error = await api('/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorApi);
    expect(error).toMatchObject({
      status: 400,
      title: 'Título',
      detail: 'Revisa',
      errores: [{ campo: 'correo', mensaje: 'Correo inválido' }],
    });
  });

  it('un fallo de red se convierte en ErrorApi con status 0', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );
    await expect(api('/x')).rejects.toMatchObject({ status: 0 });
  });

  it('ante un 401 renueva la sesión una vez y reintenta con el token nuevo', async () => {
    const fetchMock = mockFetch(problema(401), json(200, sesionDePrueba(2)), json(200, { ok: 1 }));
    await expect(api('/progreso')).resolves.toEqual({ ok: 1 });
    expect(llamada(fetchMock, 1).url).toBe(`${BASE}/auth/refresh`);
    expect(llamada(fetchMock, 1).init.body).toBe('{"refreshToken":"refresh-1"}');
    expect(llamada(fetchMock, 2).headers.get('Authorization')).toBe('Bearer acceso-2');
    expect(tokenAcceso()).toBe('acceso-2');
    expect(tokenRefresh()).toBe('refresh-2');
  });

  it('dos 401 simultáneos comparten una sola renovación', async () => {
    const fetchMock = mockFetch(
      problema(401),
      problema(401),
      json(200, sesionDePrueba(2)),
      json(200, { a: 1 }),
      json(200, { b: 2 }),
    );
    await Promise.all([api('/a'), api('/b')]);
    const renovaciones = fetchMock.mock.calls.filter(([url]) => url.endsWith('/refresh'));
    expect(renovaciones).toHaveLength(1);
  });

  it('si la renovación falla, cierra la sesión y avisa', async () => {
    const expiro = vi.fn();
    const quitar = alExpirarSesion(expiro);
    mockFetch(problema(401), problema(401));
    await expect(api('/progreso')).rejects.toMatchObject({ status: 401 });
    expect(tokenAcceso()).toBeNull();
    expect(tokenRefresh()).toBeNull();
    expect(expiro).toHaveBeenCalledOnce();
    quitar();
  });

  it('las rutas sinAuth no envían token ni intentan renovar', async () => {
    const fetchMock = mockFetch(problema(401, { detail: 'Credenciales inválidas' }));
    await expect(
      api('/auth/login', { metodo: 'POST', cuerpo: {}, sinAuth: true }),
    ).rejects.toMatchObject({ status: 401, detail: 'Credenciales inválidas' });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(llamada(fetchMock, 0).headers.get('Authorization')).toBeNull();
    expect(tokenAcceso()).toBe('acceso-1');
  });
});
