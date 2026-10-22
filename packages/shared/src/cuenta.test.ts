import { describe, expect, it } from 'vitest';
import {
  LARGO_MAXIMO_CONTRASENA,
  MENSAJE_POLITICA_CONTRASENA,
  cumplePoliticaContrasena,
  normalizarCorreo,
} from './cuenta';

describe('política de contraseña (HU-01)', () => {
  it('CA-01.4 rechaza "pollo" (corta y sin número)', () => {
    expect(cumplePoliticaContrasena('pollo')).toBe(false);
    expect(MENSAJE_POLITICA_CONTRASENA).toBe(
      'La contraseña debe tener al menos 8 caracteres, una letra y un número',
    );
  });

  it.each([
    ['Almuerzo2026', true],
    ['abcdefg1', true],
    ['ñandú2026', true],
    ['abcdefgh', false],
    ['12345678', false],
    ['abc123', false],
    ['a1'.repeat(65), false],
  ])('"%s" → %s', (contrasena, esperado) => {
    expect(cumplePoliticaContrasena(contrasena)).toBe(esperado);
  });

  it('acepta exactamente el largo máximo', () => {
    expect(cumplePoliticaContrasena('a1'.repeat(LARGO_MAXIMO_CONTRASENA / 2))).toBe(true);
  });
});

describe('normalizarCorreo', () => {
  it('quita espacios y pasa a minúsculas', () => {
    expect(normalizarCorreo('  Rene@Correo.COM ')).toBe('rene@correo.com');
  });
});
