import { describe, expect, it } from 'vitest';
import { resumenPrecios, type PrecioDeSupermercado } from './resumen-precios';

const HOY = '2026-10-24';

const p = (
  supermercado: string,
  precio: string | number,
  fecha = HOY,
  id = supermercado.toLowerCase(),
): PrecioDeSupermercado => ({ supermercadoId: id, supermercado, precio, fecha });

describe('resumenPrecios (CU-09.2)', () => {
  it('CA-36.1 con tres precios la mediana es la del medio y el mínimo el menor', () => {
    const r = resumenPrecios(
      [p('Walmart', '12.50'), p('Paiz', '13.00'), p('La Torre', '14.25')],
      HOY,
    );
    expect(r).toEqual({
      precioMediana: '13.00',
      precioMinimo: '12.50',
      supermercadoMinimoId: 'walmart',
      supermercadoMinimo: 'Walmart',
      fechaPrecioMinimo: HOY,
      cantidadPrecios: 3,
      desactualizado: false,
      fechaPrecioMasAntiguo: HOY,
    });
  });

  it('CA-36.2 con cuatro precios la mediana es el promedio de los dos del medio', () => {
    const r = resumenPrecios(
      [p('Super Fresh', 20.75), p('Walmart', 21.5), p('Paiz', 22.9), p('La Torre', 23.4)],
      HOY,
    )!;
    expect(r.precioMediana).toBe('22.20');
    expect(r.precioMinimo).toBe('20.75');
    expect(r.supermercadoMinimo).toBe('Super Fresh');
  });

  it('CA-36.3 el promedio de dos precios redondea hacia arriba: 25.725 es 25.73', () => {
    expect(resumenPrecios([p('Walmart', '24.95'), p('Paiz', '26.50')], HOY)!.precioMediana).toBe(
      '25.73',
    );
  });

  it('el redondeo no sufre errores de punto flotante (0.10 y 0.15 dan 0.13)', () => {
    expect(resumenPrecios([p('A', '0.10'), p('B', '0.15')], HOY)!.precioMediana).toBe('0.13');
    expect(resumenPrecios([p('A', '1.00'), p('B', '1.01')], HOY)!.precioMediana).toBe('1.01');
    expect(resumenPrecios([p('A', '2.00'), p('B', '4.00')], HOY)!.precioMediana).toBe('3.00');
  });

  it('1b un solo precio es mínimo y mediana', () => {
    const r = resumenPrecios([p('Walmart', '6.50')], HOY)!;
    expect([r.precioMediana, r.precioMinimo, r.cantidadPrecios]).toEqual(['6.50', '6.50', 1]);
  });

  describe('CA-36.4 vigencia de 14 días', () => {
    it('excluye el precio de hace 21 días', () => {
      const r = resumenPrecios([p('Walmart', '6.50', HOY), p('Paiz', '5.90', '2026-10-03')], HOY)!;
      expect(r).toMatchObject({
        precioMinimo: '6.50',
        precioMediana: '6.50',
        supermercadoMinimo: 'Walmart',
        cantidadPrecios: 1,
        desactualizado: false,
      });
    });

    it('14 días todavía vale y 15 ya no', () => {
      const r14 = resumenPrecios([p('A', '5', '2026-10-10'), p('B', '9', HOY)], HOY)!;
      expect(r14.cantidadPrecios).toBe(2);
      const r15 = resumenPrecios([p('A', '5', '2026-10-09'), p('B', '9', HOY)], HOY)!;
      expect(r15.cantidadPrecios).toBe(1);
      expect(r15.precioMinimo).toBe('9.00');
    });

    it('1a sin ningún vigente usa el último de cada supermercado y marca desactualizado', () => {
      const r = resumenPrecios(
        [p('Walmart', '24.95', '2026-10-03'), p('Paiz', '26.50', '2026-09-20')],
        HOY,
      )!;
      expect(r).toMatchObject({
        precioMediana: '25.73',
        precioMinimo: '24.95',
        supermercadoMinimo: 'Walmart',
        fechaPrecioMinimo: '2026-10-03',
        desactualizado: true,
        fechaPrecioMasAntiguo: '2026-09-20',
        cantidadPrecios: 2,
      });
    });
  });

  it('toma un solo precio por supermercado: el más reciente', () => {
    const r = resumenPrecios(
      [
        p('Walmart', '9.00', '2026-10-20'),
        p('Walmart', '12.50', '2026-10-23'),
        p('Walmart', '8.00', '2026-10-21'),
        p('Paiz', '13.00', '2026-10-22'),
      ],
      HOY,
    )!;
    expect(r.cantidadPrecios).toBe(2);
    expect(r.precioMinimo).toBe('12.50');
    expect(r.fechaPrecioMinimo).toBe('2026-10-23');
    expect(r.precioMediana).toBe('12.75');
  });

  describe('mínimo con supermercados preferidos (HU-09)', () => {
    const precios = [p('Walmart', '12.50'), p('Paiz', '13.00'), p('La Torre', '11.75')];

    it('CA-09.1 el mínimo sale solo de los preferidos y la mediana de todos', () => {
      const r = resumenPrecios(precios, HOY, new Set(['walmart', 'paiz']))!;
      expect(r.precioMinimo).toBe('12.50');
      expect(r.supermercadoMinimo).toBe('Walmart');
      expect(r.precioMediana).toBe('12.50');
      expect(r.cantidadPrecios).toBe(3);
    });

    it('sin preferencias (null) valen todos', () => {
      expect(resumenPrecios(precios, HOY, null)!.supermercadoMinimo).toBe('La Torre');
    });

    it('si ningún preferido tiene precio, el mínimo sale de todos', () => {
      const r = resumenPrecios(precios, HOY, new Set(['super-fresh']))!;
      expect(r.supermercadoMinimo).toBe('La Torre');
    });

    it('un preferido sin precio vigente no cuenta para el mínimo', () => {
      const r = resumenPrecios(
        [p('Walmart', '12.50'), p('Paiz', '10.00', '2026-09-01')],
        HOY,
        new Set(['paiz']),
      )!;
      expect(r.supermercadoMinimo).toBe('Walmart');
    });
  });

  describe('CA-36.5 empate en el mínimo', () => {
    it('se queda con el preferido del hogar', () => {
      const r = resumenPrecios(
        [p('Walmart', '32.00'), p('Paiz', '32.00')],
        HOY,
        new Set(['paiz']),
      )!;
      expect(r.supermercadoMinimo).toBe('Paiz');
    });

    it('si los dos son preferidos o no hay preferencias, el primero por orden alfabético', () => {
      const precios = [p('Walmart', '32.00'), p('Paiz', '32.00')];
      expect(resumenPrecios(precios, HOY, new Set(['walmart', 'paiz']))!.supermercadoMinimo).toBe(
        'Paiz',
      );
      expect(resumenPrecios(precios, HOY)!.supermercadoMinimo).toBe('Paiz');
    });
  });

  it('E1 sin ningún precio no hay resumen', () => {
    expect(resumenPrecios([], HOY)).toBeNull();
  });
});
