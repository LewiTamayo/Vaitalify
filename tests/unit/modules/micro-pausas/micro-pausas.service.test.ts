import { beforeEach, describe, expect, it, vi } from 'vitest';
import { crearRng } from '../../../../src/common/utils/random.js';

const ventanas = vi.hoisted(() => ({ obtener: vi.fn() }));
const actividades = vi.hoisted(() => ({ candidatas: vi.fn(), obtener: vi.fn() }));
const repo = vi.hoisted(() => ({ ultimaActividad: vi.fn(), crear: vi.fn(), buscar: vi.fn() }));

vi.mock('../../../../src/modules/micro-ventanas/micro-ventanas.service.js', () => ventanas);
vi.mock('../../../../src/modules/actividades/actividades.service.js', () => actividades);
vi.mock('../../../../src/modules/micro-pausas/micro-pausas.repository.js', () => repo);

const servicio = await import('../../../../src/modules/micro-pausas/micro-pausas.service.js');

const ventana5 = {
  idVentana: 1,
  fecha: '2026-10-19',
  horaInicio: '12:00',
  duracionMin: 5,
  microPausa: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  ventanas.obtener.mockResolvedValue(ventana5);
  repo.ultimaActividad.mockResolvedValue(null);
});

describe('recomendar', () => {
  it('sin actividades que quepan → 422 y no crea nada', async () => {
    actividades.candidatas.mockResolvedValue([]);
    await expect(servicio.recomendar(7, 1, undefined, crearRng(1))).rejects.toMatchObject({
      status: 422,
    });
    expect(repo.crear).not.toHaveBeenCalled();
  });

  it('pide candidatas con la duración de la ventana y evita la última actividad usada', async () => {
    actividades.candidatas.mockResolvedValue([
      { idActividad: 1, duracionMin: 5 },
      { idActividad: 2, duracionMin: 5 },
    ]);
    repo.ultimaActividad.mockResolvedValue(1);
    repo.crear.mockResolvedValue({ idPausa: 9 });
    repo.buscar.mockResolvedValue(null);
    await servicio.recomendar(7, 1, undefined, crearRng(1)).catch(() => undefined);
    expect(actividades.candidatas).toHaveBeenCalledWith(5);
    expect(repo.crear).toHaveBeenCalledWith(1, 2);
  });

  it('la ventana ya tiene micro-pausa → 409', async () => {
    ventanas.obtener.mockResolvedValue({ ...ventana5, microPausa: { idPausa: 3 } });
    await expect(servicio.recomendar(7, 1)).rejects.toMatchObject({ status: 409 });
  });
});
