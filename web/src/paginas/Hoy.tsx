import { useCallback, useEffect, useState } from 'react';
import { api, ErrorApi } from '../api/cliente';
import type { EstadoPausa, MicroPausa, MicroPausaConProgreso } from '../api/tipos';
import { prepararDia } from '../hoy/prepararDia';
import { TarjetaPausa } from '../hoy/TarjetaPausa';

const mensajeDe = (error: unknown) =>
  error instanceof ErrorApi ? error.message : 'Algo salió mal. Intenta de nuevo.';

const plural = (n: number, singular: string, varios: string) =>
  `${n} ${n === 1 ? singular : varios}`;

function textoAviso(r: MicroPausaConProgreso): string {
  if (r.estado !== 'hecha') return 'Pausa omitida. Habrá otra oportunidad más tarde.';
  const partes = [
    r.puntosGanados > 0 ? `+${r.puntosGanados} puntos` : 'Pausa registrada',
    `Racha de ${plural(r.rachaActual, 'día', 'días')}`,
    ...r.insigniasNuevas.map((i) => `Nueva insignia: ${i.nombre}`),
  ];
  return partes.join(' · ');
}

export function Hoy() {
  const [pausas, setPausas] = useState<MicroPausa[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Pausas con un PATCH en vuelo (puede haber varias a la vez).
  const [ocupadas, setOcupadas] = useState<ReadonlySet<number>>(new Set());
  const [preparando, setPreparando] = useState(false);
  const [preparado, setPreparado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setPausas(await api<MicroPausa[]>('/micro-pausas/hoy'));
    } catch (e) {
      setError(mensajeDe(e));
    }
  }, []);

  useEffect(() => {
    // Carga inicial: el estado se fija cuando responde la API, no durante el efecto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
  }, [cargar]);

  const cambiar = async (idPausa: number, estado: EstadoPausa) => {
    setOcupadas((actuales) => new Set(actuales).add(idPausa));
    setError(null);
    try {
      const respuesta = await api<MicroPausaConProgreso>(`/micro-pausas/${idPausa}`, {
        metodo: 'PATCH',
        cuerpo: { estado },
      });
      setPausas((actuales) =>
        (actuales ?? []).map((p) =>
          p.idPausa === idPausa ? { ...p, estado: respuesta.estado } : p,
        ),
      );
      setAviso(textoAviso(respuesta));
    } catch (e) {
      setError(mensajeDe(e));
    } finally {
      setOcupadas((actuales) => {
        const quedan = new Set(actuales);
        quedan.delete(idPausa);
        return quedan;
      });
    }
  };

  const preparar = async () => {
    setPreparando(true);
    setError(null);
    try {
      await prepararDia();
      await cargar();
      setPreparado(true);
    } catch (e) {
      setError(mensajeDe(e));
    } finally {
      setPreparando(false);
    }
  };

  const hechas = pausas?.filter((p) => p.estado === 'hecha').length ?? 0;

  return (
    <>
      <h1 className="titulo-pagina">Hoy</h1>
      <p className="subtitulo">
        {pausas && pausas.length > 0
          ? `${hechas} de ${plural(pausas.length, 'micro-pausa hecha', 'micro-pausas hechas')}`
          : 'Tus micro-pausas activas del día'}
      </p>

      {error && (
        <div className="alerta" role="alert">
          {error}{' '}
          {pausas === null && (
            <button className="boton boton--texto" type="button" onClick={() => void cargar()}>
              Reintentar
            </button>
          )}
        </div>
      )}

      {pausas === null && !error && <p className="cargando">Cargando…</p>}

      {pausas?.length === 0 && (
        <section className="tarjeta vacio">
          <p>Hoy no tienes micro-pausas.</p>
          {preparado && (
            <p className="texto-suave">No hay huecos libres hoy en tu horario. Vuelve mañana.</p>
          )}
          <p className="texto-suave">
            Para la demo, Vitalify puede crear tu perfil, un horario de estudio y trabajo de ejemplo
            y recomendarte pausas en los huecos libres.
          </p>
          <button
            className="boton"
            type="button"
            disabled={preparando}
            onClick={() => void preparar()}
          >
            {preparando ? 'Preparando…' : 'Preparar mi día de ejemplo'}
          </button>
        </section>
      )}

      {pausas && pausas.length > 0 && (
        <div className="pila">
          {pausas.map((p) => (
            <TarjetaPausa
              key={p.idPausa}
              pausa={p}
              ocupada={ocupadas.has(p.idPausa)}
              alCambiar={(estado) => void cambiar(p.idPausa, estado)}
            />
          ))}
        </div>
      )}

      {aviso && (
        <div className="aviso" role="status">
          <p>{aviso}</p>
          <button className="boton boton--texto" type="button" onClick={() => setAviso(null)}>
            Cerrar
          </button>
        </div>
      )}
    </>
  );
}
