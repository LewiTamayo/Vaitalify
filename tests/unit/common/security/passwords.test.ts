import { describe, expect, it } from 'vitest';
import {
  contrasenaSchema,
  hashContrasena,
  verificarContrasena,
} from '../../../../src/common/security/passwords.js';

describe('contrasenaSchema', () => {
  it('acepta 8+ caracteres con letra y número', () => {
    expect(contrasenaSchema.safeParse('secreta123').success).toBe(true);
  });

  it.each([
    ['corta1', 'menos de 8'],
    ['solotexto', 'sin número'],
    ['12345678', 'sin letra'],
    ['a1' + 'ñ'.repeat(36), 'más de 72 bytes (bcrypt truncaría)'],
  ])('rechaza %s (%s)', (valor) => {
    expect(contrasenaSchema.safeParse(valor).success).toBe(false);
  });
});

describe('hash y verificación', () => {
  it('verifica la contraseña correcta y rechaza otra', async () => {
    const hash = await hashContrasena('secreta123');
    expect(hash).not.toContain('secreta123');
    await expect(verificarContrasena('secreta123', hash)).resolves.toBe(true);
    await expect(verificarContrasena('otra1234', hash)).resolves.toBe(false);
  });

  it('sin hash (usuario inexistente) devuelve false', async () => {
    await expect(verificarContrasena('secreta123', null)).resolves.toBe(false);
  });
});

describe('límite de 72 bytes de bcrypt', () => {
  it('una contraseña de más de 72 bytes nunca verifica, aunque sus primeros 72 coincidan', async () => {
    const exacta = 'a1' + 'x'.repeat(70);
    expect(Buffer.byteLength(exacta)).toBe(72);
    const hash = await hashContrasena(exacta);
    await expect(verificarContrasena(exacta, hash)).resolves.toBe(true);
    await expect(verificarContrasena(exacta + 'basura', hash)).resolves.toBe(false);
  });
});
