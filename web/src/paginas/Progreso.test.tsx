import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { InsigniaUsuario, Progreso, ResumenSemanal } from '../api/tipos';
import { guardarSesion } from '../api/tokens';
import { json, mockRutas, problema, sesionDePrueba } from '../test/http';
import { renderApp } from '../test/render';

const progreso: Progreso = {
  puntosTotales: 130,
  rachaActual: 4,
  rachaMaxima: 9,
  diasComodin: 1,
  ultimaFechaActiva: '2026-10-17',
};

const semana = (meta: number | null, minutos = 45): ResumenSemanal => ({
  semana: { inicio: '2026-10-12', fin: '2026-10-18' },
  actividad: {
    minutosAcumulados: minutos,
    metaMinutos: meta,
    porcentajeMeta: meta ? Math.round((minutos / meta) * 100) : null,
    pausasHechas: 6,
    pausasOmitidas: 2,
  },
  racha: { actual: 4, comodinesRestantes: 1 },
});

const insignia = (codigo: string, nombre: string, fecha: string | null): InsigniaUsuario => ({
  idInsignia: codigo.length,
  codigo,
  nombre,
  descripcion: `Descripción de ${nombre}`,
  criterio: 'criterio',
  obtenida: fecha !== null,
  fechaObtencion: fecha,
});

const rutas = (resumen: ResumenSemanal) => ({
  'GET /progreso': json(200, progreso),
  'GET /progreso/semanal': json(200, resumen),
  'GET /insignias': json(200, [
    insignia('PRIMERA_PAUSA', 'Primera pausa', '2026-10-13'),
    insignia('RACHA_7', 'Racha de 7 días', null),
  ]),
});

describe('Progreso', () => {
  beforeEach(() => guardarSesion(sesionDePrueba(1)));

  it('muestra puntos, racha actual y máxima y comodines', async () => {
    mockRutas(rutas(semana(150)));
    renderApp('/progreso');

    const cifras = await screen.findByRole('list', { name: 'Resumen' });
    const valor = (nombre: string) =>
      within(cifras).getByText(nombre).parentElement?.querySelector('.cifra__valor')?.textContent;
    expect(valor('Puntos')).toBe('130');
    expect(valor('Racha actual')).toBe('4');
    expect(valor('Racha máxima')).toBe('9');
    expect(valor('Comodines esta semana')).toBe('1');
  });

  it('muestra la actividad de la semana contra la meta', async () => {
    mockRutas(rutas(semana(150)));
    renderApp('/progreso');

    const barra = await screen.findByRole('progressbar', { name: 'Minutos de actividad' });
    expect(barra).toHaveAttribute('aria-valuenow', '45');
    expect(barra).toHaveAttribute('aria-valuemax', '150');
    expect(screen.getByText('45 de 150 min (30 %)')).toBeInTheDocument();
    expect(screen.getByText('6 hechas · 2 omitidas')).toBeInTheDocument();
  });

  it('sin meta (sin perfil) no hay barra y lo explica', async () => {
    mockRutas(rutas(semana(null)));
    renderApp('/progreso');

    expect(await screen.findByText(/Configura tu meta/)).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('distingue insignias obtenidas (con fecha) de las bloqueadas', async () => {
    mockRutas(rutas(semana(150)));
    renderApp('/progreso');

    const lista = await screen.findByRole('list', { name: 'Insignias' });
    const [obtenida, bloqueada] = within(lista).getAllByRole('listitem');
    expect(obtenida).toHaveTextContent('Primera pausa');
    expect(obtenida).toHaveTextContent('Obtenida el 2026-10-13');
    expect(obtenida).not.toHaveClass('insignia--bloqueada');
    expect(bloqueada).toHaveTextContent('Racha de 7 días');
    expect(bloqueada).toHaveTextContent('Aún no');
    expect(bloqueada).toHaveClass('insignia--bloqueada');
  });

  it('si falla la carga muestra el error', async () => {
    mockRutas({
      ...rutas(semana(150)),
      'GET /progreso': problema(500, { detail: 'Error interno' }),
    });
    renderApp('/progreso');
    expect(await screen.findByRole('alert')).toHaveTextContent('Error interno');
  });
});
