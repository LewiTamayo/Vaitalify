import { beforeEach, describe, expect, it, vi } from 'vitest';

const orden: string[] = [];

const bloqueos = vi.hoisted(() => ({ conBloqueoRecordatorios: vi.fn() }));
const repo = vi.hoisted(() => ({
  pausasPendientes: vi.fn(),
  configs: vi.fn(),
  delDia: vi.fn(),
  sincronizar: vi.fn(),
}));
const sueno = vi.hoisted(() => ({ planDelDia: vi.fn() }));

vi.mock('../../../../src/common/db/bloqueos.js', () => bloqueos);
vi.mock('../../../../src/modules/recordatorios/recordatorios.repository.js', () => repo);
vi.mock('../../../../src/modules/sueno/sueno.service.js', () => sueno);

const servicio = await import('../../../../src/modules/recordatorios/recordatorios.service.js');

beforeEach(() => {
  vi.resetAllMocks();
  orden.length = 0;
  bloqueos.conBloqueoRecordatorios.mockImplementation(
    (_id: number, fn: (tx: object) => Promise<unknown>) => {
      orden.push('bloqueo');
      return fn({});
    },
  );
  sueno.planDelDia.mockResolvedValue(null);
  repo.pausasPendientes.mockResolvedValue([]);
  repo.configs.mockResolvedValue([]);
  repo.delDia.mockImplementation(() => {
    orden.push('existentes');
    return Promise.resolve([]);
  });
  repo.sincronizar.mockImplementation(() => {
    orden.push('sincronizar');
    return Promise.resolve();
  });
});

describe('generar', () => {
  it('lee los existentes y sincroniza DENTRO del bloqueo por usuario', async () => {
    await servicio.generar(7, '2026-10-19');
    expect(bloqueos.conBloqueoRecordatorios).toHaveBeenCalledWith(7, expect.any(Function));
    expect(orden).toEqual(['bloqueo', 'existentes', 'sincronizar']);
  });
});
