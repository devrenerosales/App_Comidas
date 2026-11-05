import { describe, expect, it } from 'vitest';
import {
  MENSAJE_FECHA_FUTURA,
  MENSAJE_FECHA_INVALIDA,
  MENSAJE_PRECIO_DECIMALES,
  MENSAJE_PRECIO_MUY_ALTO,
  MENSAJE_PRECIO_NO_NUMERO,
  MENSAJE_PRECIO_NO_POSITIVO,
  validarFechaCompra,
  validarPrecioMercado,
} from './precios';

describe('validarPrecioMercado (CA-34.4)', () => {
  it('acepta un precio válido y lo devuelve con dos decimales', () => {
    expect(validarPrecioMercado('20.75')).toEqual({ ok: true, precio: '20.75' });
    expect(validarPrecioMercado(12.9)).toEqual({ ok: true, precio: '12.90' });
    expect(validarPrecioMercado('6')).toEqual({ ok: true, precio: '6.00' });
    expect(validarPrecioMercado(' 6,5 ')).toEqual({ ok: true, precio: '6.50' });
    expect(validarPrecioMercado('0.01')).toEqual({ ok: true, precio: '0.01' });
    expect(validarPrecioMercado('7.')).toEqual({ ok: true, precio: '7.00' });
  });

  it('0.00 no es mayor que 0', () => {
    expect(validarPrecioMercado('0.00')).toEqual({
      ok: false,
      codigo: 'PRECIO_INVALIDO',
      mensaje: MENSAJE_PRECIO_NO_POSITIVO,
    });
    expect(validarPrecioMercado(0)).toMatchObject({ mensaje: MENSAJE_PRECIO_NO_POSITIVO });
  });

  it('un precio negativo no es mayor que 0', () => {
    expect(validarPrecioMercado('-5')).toMatchObject({ mensaje: MENSAJE_PRECIO_NO_POSITIVO });
    expect(validarPrecioMercado(-1.5)).toMatchObject({ mensaje: MENSAJE_PRECIO_NO_POSITIVO });
  });

  it('12.905 tiene más de 2 decimales', () => {
    expect(validarPrecioMercado('12.905')).toEqual({
      ok: false,
      codigo: 'PRECIO_INVALIDO',
      mensaje: MENSAJE_PRECIO_DECIMALES,
    });
    expect(validarPrecioMercado('0.001')).toMatchObject({ mensaje: MENSAJE_PRECIO_DECIMALES });
  });

  it('lo que no es un número se rechaza', () => {
    for (const valor of ['', '  ', 'abc', '12.5.1', '1e3', 'Q12', null, undefined]) {
      expect(validarPrecioMercado(valor)).toMatchObject({
        ok: false,
        mensaje: MENSAJE_PRECIO_NO_NUMERO,
      });
    }
  });

  it('respeta el tope de numeric(10,2)', () => {
    expect(validarPrecioMercado('99999999.99')).toEqual({ ok: true, precio: '99999999.99' });
    expect(validarPrecioMercado('100000000')).toMatchObject({ mensaje: MENSAJE_PRECIO_MUY_ALTO });
  });
});

describe('validarFechaCompra (CA-34.4)', () => {
  const HOY = '2026-10-25';

  it('acepta hoy y fechas anteriores', () => {
    expect(validarFechaCompra('2026-10-24', HOY)).toEqual({ ok: true, fecha: '2026-10-24' });
    expect(validarFechaCompra('2026-10-25', HOY)).toEqual({ ok: true, fecha: '2026-10-25' });
    expect(validarFechaCompra(' 2026-02-28 ', HOY)).toEqual({ ok: true, fecha: '2026-02-28' });
  });

  it('30/10/2026 es futura', () => {
    expect(validarFechaCompra('2026-10-30', HOY)).toEqual({
      ok: false,
      codigo: 'FECHA_FUTURA',
      mensaje: MENSAJE_FECHA_FUTURA,
    });
  });

  it('rechaza lo que no es una fecha real', () => {
    for (const valor of [
      '',
      '24/10/2026',
      '2026-13-01',
      '2026-02-30',
      '2026-2-3',
      null,
      undefined,
    ]) {
      expect(validarFechaCompra(valor, HOY)).toEqual({
        ok: false,
        codigo: 'FECHA_INVALIDA',
        mensaje: MENSAJE_FECHA_INVALIDA,
      });
    }
  });

  it('acepta el 29 de febrero de un año bisiesto y no el de uno común', () => {
    expect(validarFechaCompra('2024-02-29', HOY)).toMatchObject({ ok: true });
    expect(validarFechaCompra('2026-02-29', HOY)).toMatchObject({ ok: false });
  });
});
