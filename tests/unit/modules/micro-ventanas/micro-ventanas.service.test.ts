import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({
  conBloqueo: vi.fn(),
  cargarHorario: vi.fn(),
  existentes: vi.fn(),
  aplicar: vi.fn(),
}));
vi.mock('../../../../src/modules/micro-ventanas/micro-ventanas.repository.js', () => repo);

const servicio = await import('../../../../src/modules/micro-ventanas/micro-ventanas.service.js');

beforeEach(() => {
  vi.resetAllMocks();
  repo.conBloqueo.mockImplementation((_id: number, fn: (tx: object) => Promise<unknown>) => fn({}));
});

describe('recálculo serializado por usuario', () => {
  it('lee el horario y las ventanas existentes DENTRO del bloqueo', async () => {
    const orden: string[] = [];
    repo.conBloqueo.mockImplementation(
      async (_id: number, fn: (tx: object) => Promise<unknown>) => {
        orden.push('bloqueo');
        return fn({});
      },
    );
    repo.cargarHorario.mockImplementation(() => {
      orden.push('horario');
      return Promise.resolve({
        perfil: { horaDespertar: '06:15', horaDormir: '22:45' },
        bloques: [],
      });
    });
    repo.existentes.mockImplementation(() => {
      orden.push('existentes');
      return Promise.resolve([]);
    });
    await servicio.recalcular(7);
    expect(orden).toEqual(['bloqueo', 'horario', 'existentes']);
    expect(repo.conBloqueo).toHaveBeenCalledWith(7, expect.any(Function));
  });
});

describe('recalcularSemanaSinFallar', () => {
  it('un fallo del recálculo no se propaga (las ventanas son datos derivados)', async () => {
    repo.conBloqueo.mockRejectedValue(new Error('Neon no responde'));
    await expect(servicio.recalcularSemanaSinFallar(7)).resolves.toBeUndefined();
  });
});
