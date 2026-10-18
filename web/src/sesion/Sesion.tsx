import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../api/cliente';
import type { Sesion as DatosSesion, Usuario } from '../api/tipos';
import {
  alExpirarSesion,
  guardarSesion,
  limpiarSesion,
  tokenRefresh,
  usuarioGuardado,
} from '../api/tokens';

export interface DatosRegistro {
  nombre: string;
  correo: string;
  contrasena: string;
  aceptaDatos: boolean;
}

interface ValorSesion {
  usuario: Usuario | null;
  entrar: (correo: string, contrasena: string) => Promise<void>;
  registrarse: (datos: DatosRegistro) => Promise<void>;
  salir: () => Promise<void>;
}

const Contexto = createContext<ValorSesion | null>(null);

export function ProveedorSesion({ children }: Readonly<{ children: ReactNode }>) {
  const [usuario, setUsuario] = useState<Usuario | null>(usuarioGuardado);

  useEffect(() => alExpirarSesion(() => setUsuario(null)), []);

  const valor = useMemo<ValorSesion>(() => {
    const iniciar = async (ruta: string, cuerpo: object) => {
      const sesion = await api<DatosSesion>(ruta, { metodo: 'POST', cuerpo, sinAuth: true });
      guardarSesion(sesion);
      setUsuario(sesion.usuario);
    };
    return {
      usuario,
      entrar: (correo, contrasena) => iniciar('/auth/login', { correo, contrasena }),
      registrarse: (datos) => iniciar('/auth/registro', datos),
      salir: async () => {
        const refreshToken = tokenRefresh();
        // Revocar es cortesía: si falla (red, sesión ya vencida) igual se sale.
        if (refreshToken) {
          await api('/auth/logout', { metodo: 'POST', cuerpo: { refreshToken } }).catch(
            () => undefined,
          );
        }
        limpiarSesion();
        setUsuario(null);
      },
    };
  }, [usuario]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): ValorSesion {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('useSesion debe usarse dentro de ProveedorSesion');
  return valor;
}
