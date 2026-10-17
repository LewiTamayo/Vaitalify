import { describe, expect, it } from 'vitest';
import { crearLimitadorMemoria } from '../../../../src/common/ratelimit/memoria.js';

describe('crearLimitadorMemoria', () => {
  it('bloquea al superar el límite, por clave, y se reinicia con la ventana', async () => {
    let ahora = 1_000_000;
    const limitador = crearLimitadorMemoria(
      { nombre: 't', limite: 2, ventanaSeg: 60 },
      () => ahora,
    );

    expect((await limitador.consumir('a')).permitido).toBe(true);
    expect((await limitador.consumir('a')).permitido).toBe(true);
    const bloqueado = await limitador.consumir('a');
    expect(bloqueado.permitido).toBe(false);
    expect(bloqueado.restantes).toBe(0);
    expect(bloqueado.reinicioMs).toBeGreaterThan(0);

    expect((await limitador.consumir('b')).permitido).toBe(true);

    ahora += 60_000;
    expect((await limitador.consumir('a')).permitido).toBe(true);
  });
});
