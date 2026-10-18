import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MicroPausa } from '../api/tipos';
import { guardarSesion } from '../api/tokens';
import { hoyEnZona } from '../hoy/fechas';
import { HORARIO_EJEMPLO, PERFIL_EJEMPLO } from '../hoy/prepararDia';
import { json, llamadasA, mockRutas, problema, sesionDePrueba } from '../test/http';
import { renderApp } from '../test/render';

const pausa = (idPausa: number, horaInicio: string, estado = 'pendiente'): MicroPausa =>
  ({
    idPausa,
    estado,
    fechaRegistro: null,
    ventana: { idVentana: idPausa, fecha: '2026-10-17', horaInicio, duracionMin: 10 },
    actividad: {
      idActividad: 3,
      nombre: 'Estiramiento de cuello',
      categoria: 'estiramiento',
      duracionMin: 5,
      instrucciones: '1. Siéntate derecho.\n2. Inclina la cabeza.\n3. Respira.',
    },
  }) as MicroPausa;

const cuerpo = (llamadas: ReturnType<typeof llamadasA>, i = 0) =>
  JSON.parse(llamadas[i]?.[1]?.body as string) as unknown;

// GET /micro-pausas/hoy responde vacío la primera vez y con pausas después.
const hoyQueCambia = (despues: MicroPausa[]) => {
  let llamadas = 0;
  return () => json(200, llamadas++ === 0 ? [] : despues);
};

describe('Hoy', () => {
  beforeEach(() => guardarSesion(sesionDePrueba(1)));

  it('muestra las pausas de hoy con su hora, actividad y pasos', async () => {
    mockRutas({ 'GET /micro-pausas/hoy': json(200, [pausa(7, '09:00')]) });
    const { usuario } = renderApp('/hoy');

    const tarjeta = await screen.findByRole('article', { name: /09:00/ });
    expect(within(tarjeta).getByText('Estiramiento de cuello')).toBeInTheDocument();
    expect(within(tarjeta).getByText('10 min')).toBeInTheDocument();
    await usuario.click(within(tarjeta).getByText('Cómo hacerlo'));
    const pasos = within(tarjeta)
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    expect(pasos).toEqual(['Siéntate derecho.', 'Inclina la cabeza.', 'Respira.']);
  });

  it('Hecha envía un solo PATCH y avisa los puntos, la racha y la insignia', async () => {
    const fetchMock = mockRutas({
      'GET /micro-pausas/hoy': json(200, [pausa(7, '09:00')]),
      'PATCH /micro-pausas/7': json(200, {
        ...pausa(7, '09:00', 'hecha'),
        puntosGanados: 10,
        rachaActual: 3,
        insigniasNuevas: [{ codigo: 'PRIMERA_PAUSA', nombre: 'Primera pausa' }],
      }),
    });
    const { usuario } = renderApp('/hoy');
    const tarjeta = await screen.findByRole('article', { name: /09:00/ });
    await usuario.click(within(tarjeta).getByRole('button', { name: 'Hecha' }));

    const aviso = await screen.findByRole('status');
    expect(aviso).toHaveTextContent('+10 puntos');
    expect(aviso).toHaveTextContent('Racha de 3 días');
    expect(aviso).toHaveTextContent('Nueva insignia: Primera pausa');
    expect(cuerpo(llamadasA(fetchMock, 'PATCH', '/micro-pausas/7'))).toEqual({ estado: 'hecha' });
    expect(within(tarjeta).getByText('Hecha')).toBeInTheDocument();
    expect(within(tarjeta).queryByRole('button', { name: 'Hecha' })).not.toBeInTheDocument();
  });

  it('mientras una pausa se guarda, actuar sobre otra no reactiva sus botones', async () => {
    const patchA: { liberar?: (r: Response) => void } = {};
    mockRutas({
      'GET /micro-pausas/hoy': json(200, [pausa(7, '09:00'), pausa(8, '12:00')]),
      'PATCH /micro-pausas/7': () => new Promise<Response>((r) => (patchA.liberar = r)),
      'PATCH /micro-pausas/8': () => new Promise<Response>(() => undefined),
    });
    const { usuario } = renderApp('/hoy');
    const a = await screen.findByRole('article', { name: /09:00/ });
    const b = screen.getByRole('article', { name: /12:00/ });
    await usuario.click(within(a).getByRole('button', { name: 'Hecha' }));
    await usuario.click(within(b).getByRole('button', { name: 'Hecha' }));

    expect(within(a).getByRole('button', { name: 'Omitir' })).toBeDisabled();
    expect(within(b).getByRole('button', { name: 'Omitir' })).toBeDisabled();
    patchA.liberar?.(
      json(200, {
        ...pausa(7, '09:00', 'hecha'),
        puntosGanados: 10,
        rachaActual: 1,
        insigniasNuevas: [],
      }),
    );
    await waitFor(() =>
      expect(within(a).queryByRole('button', { name: 'Omitir' })).not.toBeInTheDocument(),
    );
    expect(within(b).getByRole('button', { name: 'Omitir' })).toBeDisabled();
  });

  it('Omitir envía el estado omitida', async () => {
    const fetchMock = mockRutas({
      'GET /micro-pausas/hoy': json(200, [pausa(7, '09:00')]),
      'PATCH /micro-pausas/7': json(200, {
        ...pausa(7, '09:00', 'omitida'),
        puntosGanados: 0,
        rachaActual: 0,
        insigniasNuevas: [],
      }),
    });
    const { usuario } = renderApp('/hoy');
    const tarjeta = await screen.findByRole('article', { name: /09:00/ });
    await usuario.click(within(tarjeta).getByRole('button', { name: 'Omitir' }));

    expect(await within(tarjeta).findByText('Omitida')).toBeInTheDocument();
    expect(cuerpo(llamadasA(fetchMock, 'PATCH', '/micro-pausas/7'))).toEqual({
      estado: 'omitida',
    });
  });

  it('si el PATCH falla, muestra el error y la pausa sigue pendiente', async () => {
    mockRutas({
      'GET /micro-pausas/hoy': json(200, [pausa(7, '09:00')]),
      'PATCH /micro-pausas/7': problema(422, { detail: 'La ventana aún no llega' }),
    });
    const { usuario } = renderApp('/hoy');
    const tarjeta = await screen.findByRole('article', { name: /09:00/ });
    await usuario.click(within(tarjeta).getByRole('button', { name: 'Hecha' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('La ventana aún no llega');
    expect(within(tarjeta).getByRole('button', { name: 'Hecha' })).toBeEnabled();
  });

  it('un error al cargar se muestra con la opción de reintentar', async () => {
    let intentos = 0;
    mockRutas({
      'GET /micro-pausas/hoy': () =>
        intentos++ === 0 ? problema(503, { detail: 'Base de datos caída' }) : json(200, []),
    });
    const { usuario } = renderApp('/hoy');
    expect(await screen.findByRole('alert')).toHaveTextContent('Base de datos caída');
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText(/no tienes micro-pausas/i)).toBeInTheDocument();
  });

  describe('Preparar mi día de ejemplo', () => {
    const hoy = hoyEnZona();
    const rutaVentanas = `/micro-ventanas?desde=${hoy}&hasta=${hoy}&conPausa=false&pageSize=100`;
    const ventana = (idVentana: number) => ({
      idVentana,
      fecha: hoy,
      horaInicio: '09:00',
      duracionMin: 10,
      microPausa: null,
    });

    it('a un usuario nuevo le crea el perfil, el horario y las pausas de hoy', async () => {
      const fetchMock = mockRutas({
        'GET /micro-pausas/hoy': hoyQueCambia([pausa(1, '09:00')]),
        'GET /perfil': problema(404),
        'POST /perfil': json(201, PERFIL_EJEMPLO),
        'GET /bloques?pageSize=1': json(200, { data: [], meta: { total: 0 } }),
        'POST /bloques/importar': json(201, []),
        'POST /micro-ventanas/recalcular': json(200, {
          generadas: 5,
          eliminadas: 0,
          conservadas: 0,
        }),
        [`GET ${rutaVentanas}`]: json(200, { data: [ventana(1)], meta: { total: 1 } }),
        'POST /micro-ventanas/1/micro-pausa': json(201, pausa(1, '09:00')),
      });
      const { usuario } = renderApp('/hoy');
      await usuario.click(
        await screen.findByRole('button', { name: 'Preparar mi día de ejemplo' }),
      );

      expect(await screen.findByRole('article', { name: /09:00/ })).toBeInTheDocument();
      expect(cuerpo(llamadasA(fetchMock, 'POST', '/perfil'))).toEqual(PERFIL_EJEMPLO);
      expect(cuerpo(llamadasA(fetchMock, 'POST', '/bloques/importar'))).toEqual({
        bloques: HORARIO_EJEMPLO,
      });
      expect(llamadasA(fetchMock, 'POST', '/micro-ventanas/1/micro-pausa')).toHaveLength(1);
    });

    it('no importa bloques si ya existen y tolera los 409 del perfil y de las pausas', async () => {
      const fetchMock = mockRutas({
        'GET /micro-pausas/hoy': hoyQueCambia([pausa(1, '09:00'), pausa(2, '12:00')]),
        'GET /perfil': problema(404),
        'POST /perfil': problema(409, { detail: 'El perfil ya existe' }),
        'GET /bloques?pageSize=1': json(200, { data: [{}], meta: { total: 4 } }),
        'POST /micro-ventanas/recalcular': json(200, {
          generadas: 5,
          eliminadas: 0,
          conservadas: 0,
        }),
        [`GET ${rutaVentanas}`]: json(200, {
          data: [ventana(1), ventana(2)],
          meta: { total: 2 },
        }),
        'POST /micro-ventanas/1/micro-pausa': json(201, pausa(1, '09:00')),
        'POST /micro-ventanas/2/micro-pausa': problema(409),
      });
      const { usuario } = renderApp('/hoy');
      await usuario.click(
        await screen.findByRole('button', { name: 'Preparar mi día de ejemplo' }),
      );

      expect(await screen.findAllByRole('article')).toHaveLength(2);
      expect(llamadasA(fetchMock, 'POST', '/bloques/importar')).toHaveLength(0);
      // Con bloques ya creados (p. ej. una semana después) igual recalcula las ventanas de hoy.
      expect(cuerpo(llamadasA(fetchMock, 'POST', '/micro-ventanas/recalcular'))).toEqual({
        desde: hoy,
        hasta: hoy,
      });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('si después de preparar no hay pausas, lo explica', async () => {
      mockRutas({
        'GET /micro-pausas/hoy': json(200, []),
        'GET /perfil': json(200, PERFIL_EJEMPLO),
        'GET /bloques?pageSize=1': json(200, { data: [{}], meta: { total: 4 } }),
        'POST /micro-ventanas/recalcular': json(200, {
          generadas: 5,
          eliminadas: 0,
          conservadas: 0,
        }),
        [`GET ${rutaVentanas}`]: json(200, { data: [], meta: { total: 0 } }),
      });
      const { usuario } = renderApp('/hoy');
      await usuario.click(
        await screen.findByRole('button', { name: 'Preparar mi día de ejemplo' }),
      );
      expect(await screen.findByText(/No hay huecos libres hoy/)).toBeInTheDocument();
    });

    it('un error distinto de 409 detiene la preparación y se muestra', async () => {
      mockRutas({
        'GET /micro-pausas/hoy': json(200, []),
        'GET /perfil': problema(500, { detail: 'Error interno' }),
      });
      const { usuario } = renderApp('/hoy');
      await usuario.click(
        await screen.findByRole('button', { name: 'Preparar mi día de ejemplo' }),
      );
      expect(await screen.findByRole('alert')).toHaveTextContent('Error interno');
    });
  });
});
