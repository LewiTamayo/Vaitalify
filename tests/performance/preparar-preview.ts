// Usuarios temporales para el smoke contra Vercel Preview (spec §19.1, U-9).
// La base del Preview es una rama de Neon distinta de `perf`: los usuarios del CSV no existen
// allí. Se crean por la propia API (perfil, horario y pausas de hoy) y se borran al terminar.
import { randomBytes } from 'node:crypto';
import { horarioPerf } from '../../prisma/seed-perf-datos.js';

interface Sesion {
  accessToken: string;
}

interface Ventana {
  idVentana: number;
}

export interface UsuariosPreview {
  csv: string;
  borrar: () => Promise<void>;
}

const PERFIL = {
  horaDormir: '22:45',
  horaDespertar: '06:15',
  metaHorasSueno: 7.5,
  metaMinActividad: 150,
};

function cliente(base: string, bypass: string) {
  return async <T>(ruta: string, metodo: string, token?: string, cuerpo?: unknown): Promise<T> => {
    const respuesta = await fetch(`${base}/api/v1${ruta}`, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        'x-vercel-protection-bypass': bypass,
        'x-test-run': 'smoke-preview',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    if (!respuesta.ok && respuesta.status !== 409) {
      throw new Error(`${metodo} ${ruta} → ${respuesta.status}`);
    }
    return (respuesta.status === 204 ? undefined : await respuesta.json()) as T;
  };
}

export async function prepararUsuarios(
  base: string,
  bypass: string,
  cantidad: number,
  hoy: string,
): Promise<UsuariosPreview> {
  const pedir = cliente(base, bypass);
  const contrasena = randomBytes(12).toString('base64url');
  const sello = Date.now();
  const tokens: string[] = [];
  const correos: string[] = [];
  try {
    for (let k = 1; k <= cantidad; k++) {
      const correo = `smoke_${sello}_${k}@vitalify.test`;
      const { accessToken } = await pedir<Sesion>('/auth/registro', 'POST', undefined, {
        nombre: `Smoke ${k}`,
        correo,
        contrasena,
        aceptaDatos: true,
      });
      tokens.push(accessToken);
      correos.push(correo);
      await pedir('/perfil', 'POST', accessToken, PERFIL);
      await pedir('/bloques/importar', 'POST', accessToken, { bloques: horarioPerf(k) });
      const consulta = `desde=${hoy}&hasta=${hoy}&conPausa=false&pageSize=100`;
      const { data } = await pedir<{ data: Ventana[] }>(
        `/micro-ventanas?${consulta}`,
        'GET',
        accessToken,
      );
      for (const { idVentana } of data) {
        await pedir(`/micro-ventanas/${idVentana}/micro-pausa`, 'POST', accessToken, {});
      }
    }
  } catch (error) {
    await borrarTodos(pedir, tokens);
    throw error;
  }
  return {
    csv: ['correo,contrasena', ...correos.map((c) => `${c},${contrasena}`)].join('\n') + '\n',
    borrar: () => borrarTodos(pedir, tokens),
  };
}

async function borrarTodos(pedir: ReturnType<typeof cliente>, tokens: string[]): Promise<void> {
  for (const token of tokens) await pedir('/usuarios/me', 'DELETE', token).catch(() => undefined);
}
