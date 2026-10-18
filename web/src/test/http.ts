import { vi } from 'vitest';
import type { Sesion } from '../api/tipos';

export const BASE = 'http://localhost:3000/api/v1';

export const sesionDePrueba = (n = 1): Sesion => ({
  usuario: { idUsuario: 1, nombre: 'Ana', correo: 'ana@x.co', rol: 'user' },
  accessToken: `acceso-${n}`,
  refreshToken: `refresh-${n}`,
});

export const json = (status: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const problema = (status: number, extra: object = {}) =>
  new Response(JSON.stringify({ type: 'x', title: 'Título', status, ...extra }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });

export const vacio = () => new Response(null, { status: 204 });

type Respondedor = (url: string, init: RequestInit) => Response | undefined;

// Responde en orden con las respuestas dadas (o con un enrutador por URL y método).
export function mockFetch(...respuestas: Array<Response | Respondedor>) {
  const fetchMock = vi.fn((url: string, init: RequestInit = {}): Promise<Response> => {
    const siguiente = respuestas.shift();
    const respuesta = typeof siguiente === 'function' ? siguiente(url, init) : siguiente;
    if (!respuesta) throw new Error(`fetch inesperado: ${init.method ?? 'GET'} ${url}`);
    return Promise.resolve(respuesta);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export type FetchMock = ReturnType<typeof mockFetch>;

// Enrutador fijo: "METODO /ruta" → respuesta (o función que la crea en cada llamada).
export function mockRutas(rutas: Record<string, Response | (() => Response | Promise<Response>)>) {
  const fetchMock = vi.fn((url: string, init: RequestInit = {}): Promise<Response> => {
    const clave = `${init.method ?? 'GET'} ${url.replace(BASE, '')}`;
    const respuesta = rutas[clave];
    if (!respuesta) throw new Error(`ruta sin mock: ${clave}`);
    return Promise.resolve(typeof respuesta === 'function' ? respuesta() : respuesta.clone());
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export const llamada = (fetchMock: FetchMock, i: number) => {
  const [url, init = {}] = fetchMock.mock.calls[i] ?? [];
  return { url, init, headers: new Headers(init.headers) };
};

export const llamadasA = (fetchMock: FetchMock, metodo: string, ruta: string) =>
  fetchMock.mock.calls.filter(
    ([url, init]) => (init?.method ?? 'GET') === metodo && url === `${BASE}${ruta}`,
  );
