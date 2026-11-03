import { describe, expect, it } from 'vitest';
import {
  MENSAJES_PRECIO,
  PRECIO_MAXIMO,
  precioNormalizado,
  promedioDeCompra,
  validarPrecio,
} from './precio-compra';

describe('validarPrecio (CU-07.7 E1 y E2)', () => {
  it('acepta precios positivos con hasta 2 decimales', () => {
    expect(validarPrecio('28.10')).toEqual({ ok: true, valor: 28.1 });
    expect(validarPrecio(' 12.5 ')).toEqual({ ok: true, valor: 12.5 });
    expect(validarPrecio(27)).toEqual({ ok: true, valor: 27 });
    expect(validarPrecio(PRECIO_MAXIMO)).toEqual({ ok: true, valor: PRECIO_MAXIMO });
    expect(validarPrecio('12.350')).toEqual({ ok: true, valor: 12.35 });
    expect(validarPrecio('0.01')).toEqual({ ok: true, valor: 0.01 });
  });

  it('CA-44.5 rechaza 0 y negativos con el mensaje de precio mayor que Q0.00', () => {
    for (const malo of ['0', '-5.00', '0.00', -1, 0, '-0.001']) {
      expect(validarPrecio(malo)).toEqual({ ok: false, mensaje: MENSAJES_PRECIO.noPositivo });
    }
  });

  it('CA-44.5 rechaza más de 2 decimales', () => {
    expect(validarPrecio('12.345')).toEqual({ ok: false, mensaje: 'Usa máximo 2 decimales' });
    expect(validarPrecio(12.345)).toEqual({ ok: false, mensaje: MENSAJES_PRECIO.decimales });
    expect(validarPrecio('0.001')).toEqual({ ok: false, mensaje: MENSAJES_PRECIO.decimales });
  });

  it('rechaza lo que pase de Q99,999.99', () => {
    expect(validarPrecio('100000')).toEqual({ ok: false, mensaje: MENSAJES_PRECIO.maximo });
    expect(validarPrecio('99999.991')).toEqual({ ok: false, mensaje: MENSAJES_PRECIO.decimales });
  });

  it('rechaza vacío, texto y valores que no son un número', () => {
    for (const malo of ['', '  ', 'abc', '12,50', '1e3', '--5', null, undefined, NaN]) {
      expect(validarPrecio(malo as never)).toEqual({
        ok: false,
        mensaje: MENSAJES_PRECIO.invalido,
      });
    }
  });
});

describe('precioNormalizado (CU-07.7 paso 5)', () => {
  it('CA-44.1 una bolsa de 2 lb a Q28.10 queda en Q28.10', () => {
    expect(precioNormalizado(28.1, 2, 2)).toBe(28.1);
  });

  it('CA-44.2 una bolsa de 5 lb a Q66.25 con presentación de 2 lb queda en Q26.50', () => {
    expect(precioNormalizado('66.25', '2', '5')).toBe(26.5);
  });

  it('dos bolsas de 2 lb por Q54.00 quedan en Q27.00 por bolsa', () => {
    expect(precioNormalizado(54, 2, 4)).toBe(27);
  });

  it('redondea a centavos', () => {
    expect(precioNormalizado(10, 1, 3)).toBe(3.33);
  });
});

describe('promedioDeCompra (RN-12)', () => {
  const HOY = new Date('2026-10-25T12:00:00.000Z');

  it('CA-44.1 promedia las compras de las últimas 12 semanas: Q27.20 con 3 compras', () => {
    expect(
      promedioDeCompra(
        [
          { precioNormalizado: 24, compradoEn: '2026-07-12T10:00:00.000Z' },
          { precioNormalizado: '26.50', compradoEn: '2026-09-13T10:00:00.000Z' },
          { precioNormalizado: 27, compradoEn: new Date('2026-10-04T10:00:00.000Z') },
          { precioNormalizado: 28.1, compradoEn: '2026-10-18T10:00:00.000Z' },
        ],
        HOY,
      ),
    ).toEqual({ promedio: 27.2, compras: 3 });
  });

  it('una compra justo en el límite de 84 días entra y un día antes no', () => {
    const limite = new Date(HOY.getTime() - 84 * 86_400_000);
    expect(promedioDeCompra([{ precioNormalizado: 10, compradoEn: limite }], HOY)).toEqual({
      promedio: 10,
      compras: 1,
    });
    expect(
      promedioDeCompra(
        [{ precioNormalizado: 10, compradoEn: new Date(limite.getTime() - 1) }],
        HOY,
      ),
    ).toBeNull();
  });

  it('sin compras, o todas fuera de la ventana, no hay promedio', () => {
    expect(promedioDeCompra([], HOY)).toBeNull();
    expect(
      promedioDeCompra([{ precioNormalizado: 5, compradoEn: '2026-01-01T00:00:00.000Z' }], HOY),
    ).toBeNull();
  });

  it('redondea el promedio a centavos', () => {
    expect(
      promedioDeCompra(
        [
          { precioNormalizado: 10, compradoEn: '2026-10-20T00:00:00.000Z' },
          { precioNormalizado: 10, compradoEn: '2026-10-21T00:00:00.000Z' },
          { precioNormalizado: 10.01, compradoEn: '2026-10-22T00:00:00.000Z' },
        ],
        HOY,
      ),
    ).toEqual({ promedio: 10, compras: 3 });
  });
});
