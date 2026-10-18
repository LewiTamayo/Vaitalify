import type { ErrorCampo, Sesion } from './tipos';
import { expirarSesion, guardarSesion, tokenAcceso, tokenRefresh } from './tokens';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

// Problema RFC 7807 de la API (status 0 = sin conexión).
export class ErrorApi extends Error {
  constructor(
    readonly status: number,
    readonly title: string,
    readonly detail?: string,
    readonly errores: ErrorCampo[] = [],
  ) {
    super(detail ?? title);
    this.name = 'ErrorApi';
  }
}

interface Opciones {
  metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  cuerpo?: unknown;
  sinAuth?: boolean;
}

interface Problema {
  title?: string;
  detail?: string;
  errors?: ErrorCampo[];
}

async function aError(respuesta: Response): Promise<ErrorApi> {
  const problema = (await respuesta.json().catch(() => ({}))) as Problema;
  return new ErrorApi(
    respuesta.status,
    problema.title ?? respuesta.statusText,
    problema.detail,
    problema.errors ?? [],
  );
}

async function enviar(ruta: string, { metodo = 'GET', cuerpo, sinAuth }: Opciones) {
  const headers = new Headers({ Accept: 'application/json' });
  if (cuerpo !== undefined) headers.set('Content-Type', 'application/json');
  const token = sinAuth ? null : tokenAcceso();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  try {
    return await fetch(`${API_URL}${ruta}`, {
      method: metodo,
      headers,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorApi(0, 'Sin conexión', 'No se pudo contactar la API. Revisa tu conexión.');
  }
}

// Una sola renovación en vuelo, compartida por todas las peticiones que reciban 401.
let renovacion: Promise<boolean> | null = null;

// true = sesión renovada; false = la API la rechazó (401/400: el refresh token ya no sirve).
// Fallos transitorios (red, 429, 5xx) lanzan ErrorApi y conservan el refresh token.
async function renovarSesion(): Promise<boolean> {
  const refreshToken = tokenRefresh();
  if (!refreshToken) return false;
  const respuesta = await enviar('/auth/refresh', {
    metodo: 'POST',
    cuerpo: { refreshToken },
    sinAuth: true,
  });
  if (respuesta.status === 400 || respuesta.status === 401) return false;
  if (!respuesta.ok) throw await aError(respuesta);
  guardarSesion((await respuesta.json()) as Sesion);
  return true;
}

function renovarUnaVez(): Promise<boolean> {
  renovacion ??= renovarSesion().finally(() => {
    renovacion = null;
  });
  return renovacion;
}

// Tras recargar la página solo queda el refresh token: obtiene un token de acceso antes de
// una operación cuyo cuerpo depende del refresh token vigente (p. ej. el logout).
export async function asegurarAcceso(): Promise<void> {
  if (!tokenAcceso() && tokenRefresh()) await renovarUnaVez();
}

export async function api<T>(ruta: string, opciones: Opciones = {}): Promise<T> {
  let respuesta = await enviar(ruta, opciones);
  if (respuesta.status === 401 && !opciones.sinAuth) {
    if (await renovarUnaVez()) respuesta = await enviar(ruta, opciones);
    if (respuesta.status === 401) {
      const error = await aError(respuesta);
      expirarSesion();
      throw error;
    }
  }
  if (!respuesta.ok) throw await aError(respuesta);
  if (respuesta.status === 204) return undefined as T;
  return (await respuesta.json()) as T;
}
