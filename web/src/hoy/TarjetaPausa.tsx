import { useId } from 'react';
import type { EstadoPausa, MicroPausa } from '../api/tipos';

const ETIQUETAS: Record<EstadoPausa, string> = {
  pendiente: 'Pendiente',
  hecha: 'Hecha',
  omitida: 'Omitida',
};

// "1. Paso uno.\n2. Paso dos." → ["Paso uno.", "Paso dos."]
export const pasos = (instrucciones: string): string[] =>
  instrucciones
    .split('\n')
    .map((linea) => linea.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter((linea) => linea.length > 0);

export function TarjetaPausa({
  pausa,
  ocupada,
  alCambiar,
}: Readonly<{
  pausa: MicroPausa;
  ocupada: boolean;
  alCambiar: (estado: EstadoPausa) => void;
}>) {
  const idTitulo = useId();
  const { ventana, actividad, estado } = pausa;
  const pendiente = estado === 'pendiente';

  return (
    <article
      className={`tarjeta pausa${pendiente ? '' : ' pausa--cerrada'}`}
      aria-labelledby={idTitulo}
    >
      <div className="pausa__cabecera">
        <h2 id={idTitulo} className="pausa__hora">
          {ventana.horaInicio}
        </h2>
        <span className="pausa__duracion">{ventana.duracionMin} min</span>
        <span className={`etiqueta${estado === 'hecha' ? ' etiqueta--hecha' : ''}`}>
          {ETIQUETAS[estado]}
        </span>
      </div>
      <div>
        <h3 className="pausa__actividad">{actividad.nombre}</h3>
        <p className="texto-suave">Actividad de {actividad.duracionMin} min</p>
      </div>
      <details>
        <summary>Cómo hacerlo</summary>
        <ol>
          {pasos(actividad.instrucciones).map((paso) => (
            <li key={paso}>{paso}</li>
          ))}
        </ol>
      </details>
      {pendiente && (
        <div className="pausa__acciones">
          <button
            className="boton"
            type="button"
            disabled={ocupada}
            onClick={() => alCambiar('hecha')}
          >
            Hecha
          </button>
          <button
            className="boton boton--secundario"
            type="button"
            disabled={ocupada}
            onClick={() => alCambiar('omitida')}
          >
            Omitir
          </button>
        </div>
      )}
    </article>
  );
}
