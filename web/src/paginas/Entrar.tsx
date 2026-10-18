import { useId, useState, type SubmitEvent } from 'react';
import { ErrorApi } from '../api/cliente';
import { useSesion } from '../sesion/Sesion';

type Modo = 'entrar' | 'registro';
type Campo = 'nombre' | 'correo' | 'contrasena';

interface Errores {
  general: string | null;
  campos: Partial<Record<Campo, string>>;
}

const SIN_ERRORES: Errores = { general: null, campos: {} };
const CAMPOS: readonly string[] = ['nombre', 'correo', 'contrasena'];

function aErrores(error: unknown): Errores {
  if (!(error instanceof ErrorApi))
    return { general: 'Algo salió mal. Intenta de nuevo.', campos: {} };
  const campos: Errores['campos'] = {};
  const otros: string[] = [];
  for (const { campo, mensaje } of error.errores) {
    if (CAMPOS.includes(campo)) campos[campo as Campo] = mensaje;
    else otros.push(mensaje);
  }
  if (otros.length > 0) return { general: otros.join('. '), campos };
  // Sin errores por campo, el mensaje del problema (detail o title) va arriba.
  return { general: error.errores.length === 0 ? error.message : null, campos };
}

function CampoTexto(
  props: Readonly<{
    etiqueta: string;
    tipo: string;
    valor: string;
    alCambiar: (valor: string) => void;
    error?: string;
    autocompletar: string;
  }>,
) {
  const id = useId();
  return (
    <div className="campo">
      <label htmlFor={id}>{props.etiqueta}</label>
      <input
        id={id}
        type={props.tipo}
        value={props.valor}
        autoComplete={props.autocompletar}
        onChange={(e) => props.alCambiar(e.target.value)}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={props.error ? `${id}-error` : undefined}
      />
      {props.error && (
        <span id={`${id}-error`} className="error-campo">
          {props.error}
        </span>
      )}
    </div>
  );
}

export function Entrar() {
  const { entrar, registrarse } = useSesion();
  const [modo, setModo] = useState<Modo>('entrar');
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [aceptaDatos, setAceptaDatos] = useState(false);
  const [errores, setErrores] = useState<Errores>(SIN_ERRORES);
  const [enviando, setEnviando] = useState(false);

  const cambiarModo = (nuevo: Modo) => {
    setModo(nuevo);
    setErrores(SIN_ERRORES);
  };

  const enviar = async (evento: SubmitEvent) => {
    evento.preventDefault();
    if (modo === 'registro' && !aceptaDatos) {
      setErrores({
        general: 'Debes autorizar el tratamiento de tus datos para crear la cuenta.',
        campos: {},
      });
      return;
    }
    setEnviando(true);
    setErrores(SIN_ERRORES);
    try {
      if (modo === 'entrar') await entrar(correo, contrasena);
      else await registrarse({ nombre, correo, contrasena, aceptaDatos });
    } catch (error) {
      setErrores(aErrores(error));
      setEnviando(false);
    }
  };

  const textoBoton = modo === 'entrar' ? 'Entrar' : 'Crear cuenta';

  return (
    <main className="contenedor">
      <h1 className="titulo-pagina">Vitalify</h1>
      <p className="subtitulo">Micro-pausas activas y mejor sueño, aunque estudies y trabajes.</p>
      <section className="tarjeta">
        <div className="pestanas" role="tablist" aria-label="Acceso">
          <button
            type="button"
            role="tab"
            aria-selected={modo === 'entrar'}
            onClick={() => cambiarModo('entrar')}
          >
            Entrar
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={modo === 'registro'}
            onClick={() => cambiarModo('registro')}
          >
            Crear cuenta
          </button>
        </div>

        <form onSubmit={(e) => void enviar(e)} noValidate>
          {errores.general && (
            <p className="alerta" role="alert">
              {errores.general}
            </p>
          )}
          {modo === 'registro' && (
            <CampoTexto
              etiqueta="Nombre"
              tipo="text"
              valor={nombre}
              alCambiar={setNombre}
              error={errores.campos.nombre}
              autocompletar="name"
            />
          )}
          <CampoTexto
            etiqueta="Correo"
            tipo="email"
            valor={correo}
            alCambiar={setCorreo}
            error={errores.campos.correo}
            autocompletar="email"
          />
          <CampoTexto
            etiqueta="Contraseña"
            tipo="password"
            valor={contrasena}
            alCambiar={setContrasena}
            error={errores.campos.contrasena}
            autocompletar={modo === 'entrar' ? 'current-password' : 'new-password'}
          />
          {modo === 'registro' && (
            <label className="casilla">
              <input
                type="checkbox"
                checked={aceptaDatos}
                onChange={(e) => setAceptaDatos(e.target.checked)}
              />
              <span>
                Autorizo el tratamiento de mis datos personales según la Ley 1581 de 2012.
              </span>
            </label>
          )}
          <button className="boton boton--ancho" type="submit" disabled={enviando}>
            {textoBoton}
          </button>
        </form>
      </section>
    </main>
  );
}
