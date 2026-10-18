import { useEffect, useState } from 'react';
import { api, ErrorApi } from '../api/cliente';
import type { InsigniaUsuario, Progreso as DatosProgreso, ResumenSemanal } from '../api/tipos';

interface Datos {
  progreso: DatosProgreso;
  semana: ResumenSemanal;
  insignias: InsigniaUsuario[];
}

async function cargarDatos(): Promise<Datos> {
  const [progreso, semana, insignias] = await Promise.all([
    api<DatosProgreso>('/progreso'),
    api<ResumenSemanal>('/progreso/semanal'),
    api<InsigniaUsuario[]>('/insignias'),
  ]);
  return { progreso, semana, insignias };
}

function Cifra({ nombre, valor }: Readonly<{ nombre: string; valor: number }>) {
  return (
    <li className="tarjeta cifra">
      <span className="cifra__valor">{valor}</span>
      <span className="cifra__nombre">{nombre}</span>
    </li>
  );
}

function Actividad({ actividad }: Readonly<{ actividad: ResumenSemanal['actividad'] }>) {
  const { minutosAcumulados, metaMinutos, porcentajeMeta, pausasHechas, pausasOmitidas } =
    actividad;
  return (
    <section className="tarjeta">
      <h2 className="seccion-titulo seccion-titulo--primera">Actividad de la semana</h2>
      {metaMinutos === null ? (
        <p className="texto-suave">
          {minutosAcumulados} min esta semana. Configura tu meta en tu perfil para ver tu avance.
        </p>
      ) : (
        <>
          <div
            className="barra"
            role="progressbar"
            aria-label="Minutos de actividad"
            aria-valuemin={0}
            aria-valuemax={metaMinutos}
            aria-valuenow={minutosAcumulados}
          >
            <div
              className="barra__relleno"
              style={{ width: `${Math.min(porcentajeMeta ?? 0, 100)}%` }}
            />
          </div>
          <p className="texto-suave">
            {minutosAcumulados} de {metaMinutos} min ({porcentajeMeta} %)
          </p>
        </>
      )}
      <p className="texto-suave">
        {pausasHechas} hechas · {pausasOmitidas} omitidas
      </p>
    </section>
  );
}

function Insignia({ insignia }: Readonly<{ insignia: InsigniaUsuario }>) {
  return (
    <li className={`tarjeta insignia${insignia.obtenida ? '' : ' insignia--bloqueada'}`}>
      <span className="insignia__icono" aria-hidden="true">
        {insignia.obtenida ? '🏅' : '🔒'}
      </span>
      <strong>{insignia.nombre}</strong>
      <span className="texto-suave">{insignia.descripcion}</span>
      <span className="texto-suave">
        {insignia.obtenida ? `Obtenida el ${insignia.fechaObtencion}` : 'Aún no'}
      </span>
    </li>
  );
}

export function Progreso() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    cargarDatos()
      .then((d) => vigente && setDatos(d))
      .catch((e: unknown) => {
        if (vigente) setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar tu progreso.');
      });
    return () => {
      vigente = false;
    };
  }, []);

  return (
    <>
      <h1 className="titulo-pagina">Tu progreso</h1>
      <p className="subtitulo">La racha no se rompe por un día: tienes 2 comodines por semana.</p>
      {error && (
        <p className="alerta" role="alert">
          {error}
        </p>
      )}
      {!datos && !error && <p className="cargando">Cargando…</p>}
      {datos && (
        <div className="pila">
          <ul className="cifras" aria-label="Resumen">
            <Cifra nombre="Puntos" valor={datos.progreso.puntosTotales} />
            <Cifra nombre="Racha actual" valor={datos.progreso.rachaActual} />
            <Cifra nombre="Racha máxima" valor={datos.progreso.rachaMaxima} />
            <Cifra nombre="Comodines esta semana" valor={datos.progreso.diasComodin} />
          </ul>
          <Actividad actividad={datos.semana.actividad} />
          <h2 className="seccion-titulo">Insignias</h2>
          <ul className="insignias" aria-label="Insignias">
            {datos.insignias.map((i) => (
              <Insignia key={i.idInsignia} insignia={i} />
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
