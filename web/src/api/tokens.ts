import type { Sesion, Usuario } from './tipos';

// El token de acceso vive solo en memoria. El refresh token y el usuario van a
// sessionStorage para sobrevivir a una recarga; se borran al cerrar la pestaña.
// Concesión de demo: un XSS podría leerlo (la versión real usaría una cookie httpOnly).
const CLAVE = 'vitalify.sesion';

let acceso: string | null = null;
const oyentes = new Set<() => void>();

interface Guardado {
  usuario: Usuario;
  refreshToken: string;
}

function leer(): Guardado | null {
  try {
    const crudo = sessionStorage.getItem(CLAVE);
    return crudo ? (JSON.parse(crudo) as Guardado) : null;
  } catch {
    return null;
  }
}

export function guardarSesion({ usuario, accessToken, refreshToken }: Sesion): void {
  acceso = accessToken;
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify({ usuario, refreshToken }));
  } catch {
    // Sin almacenamiento la sesión dura lo que el token de acceso.
  }
}

export function limpiarSesion(): void {
  acceso = null;
  try {
    sessionStorage.removeItem(CLAVE);
  } catch {
    // Nada que borrar.
  }
}

export const tokenAcceso = (): string | null => acceso;
export const tokenRefresh = (): string | null => leer()?.refreshToken ?? null;
export const usuarioGuardado = (): Usuario | null => leer()?.usuario ?? null;

// La sesión expiró sin poder renovarse: avisa a quien escuche (el contexto de sesión).
export function alExpirarSesion(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

export function expirarSesion(): void {
  limpiarSesion();
  oyentes.forEach((oyente) => oyente());
}
