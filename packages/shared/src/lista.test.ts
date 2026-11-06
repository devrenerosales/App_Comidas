import { describe, expect, it } from 'vitest';
import { consolidarLista, type IngredienteDeComida, type UnidadConId } from './lista';

const LB: UnidadConId = { id: 'u-lb', codigo: 'lb', magnitud: 'MASA', factorBase: 453.592 };
const G: UnidadConId = { id: 'u-g', codigo: 'g', magnitud: 'MASA', factorBase: 1 };
const TAZA: UnidadConId = { id: 'u-taza', codigo: 'taza', magnitud: 'VOLUMEN', factorBase: 240 };
const CUCHARADITA: UnidadConId = {
  id: 'u-cdta',
  codigo: 'cucharadita',
  magnitud: 'VOLUMEN',
  factorBase: 5,
};

const ing = (
  menuDetalleId: string,
  productoId: string,
  cantidad: number,
  unidad: UnidadConId,
  presentacion: { cantidad: number; unidad: UnidadConId },
  extra: Partial<IngredienteDeComida> = {},
): IngredienteDeComida => ({
  menuDetalleId,
  productoId,
  cantidad,
  porcionesBase: 4,
  unidad,
  presentacion,
  equivalencia: null,
  ...extra,
});
const UNA_LIBRA = { cantidad: 1, unidad: LB };

describe('consolidarLista', () => {
  it('CA-28.1 el mismo producto en dos platillos se suma: 6.75 lb requeridas, 7 a comprar', () => {
    const [item, ...resto] = consolidarLista(
      [ing('dom', 'pollo', 2, LB, UNA_LIBRA), ing('mie', 'pollo', 2.5, LB, UNA_LIBRA)],
      6,
    );
    expect(resto).toEqual([]);
    expect(item).toEqual({
      productoId: 'pollo',
      cantidadRequerida: 6.75,
      unidadRequeridaId: 'u-lb',
      equivalente: 6.75,
      cantidadComprar: 7,
      sinConversion: false,
      origenes: [
        { menuDetalleId: 'dom', cantidadRequerida: 3 },
        { menuDetalleId: 'mie', cantidadRequerida: 3.75 },
      ],
    });
  });

  it('CA-28.2 gramos de tomate: 800 g requeridos equivalen a 1.764 lb y se compran 2', () => {
    const [item] = consolidarLista(
      [ing('a', 'tomate', 500, G, UNA_LIBRA), ing('b', 'tomate', 300, G, UNA_LIBRA)],
      4,
    );
    expect(item).toMatchObject({
      cantidadRequerida: 800,
      unidadRequeridaId: 'u-g',
      equivalente: 1.764,
      cantidadComprar: 2,
      sinConversion: false,
    });
  });

  it('CA-28.3 una unidad sin equivalencia queda "Sin conversión" y los demás productos salen normal', () => {
    const items = consolidarLista(
      [
        ing('s', 'oregano', 1, CUCHARADITA, { cantidad: 10, unidad: G }, { porcionesBase: 1 }),
        ing('s', 'pollo', 2, LB, UNA_LIBRA, { porcionesBase: 1 }),
      ],
      1,
    );
    expect(items[0]).toEqual({
      productoId: 'oregano',
      cantidadRequerida: 1,
      unidadRequeridaId: 'u-cdta',
      equivalente: null,
      cantidadComprar: 1,
      sinConversion: true,
      origenes: [{ menuDetalleId: 's', cantidadRequerida: 1 }],
    });
    expect(items[1]).toMatchObject({
      productoId: 'pollo',
      cantidadComprar: 2,
      sinConversion: false,
    });
  });

  it('CA-28.5 con Σ 2.5, 2 lb para 4 porciones son 1.25 lb y se compran 2', () => {
    const [item] = consolidarLista([ing('a', 'pollo', 2, LB, UNA_LIBRA)], 2.5);
    expect(item).toMatchObject({ cantidadRequerida: 1.25, cantidadComprar: 2 });
  });

  it('una equivalencia registrada convierte de otra magnitud (taza de arroz → lb)', () => {
    const [item] = consolidarLista(
      [ing('a', 'arroz', 2, TAZA, { cantidad: 2, unidad: LB }, { equivalencia: 0.45 })],
      4,
    );
    expect(item).toMatchObject({
      cantidadRequerida: 2,
      unidadRequeridaId: 'u-taza',
      equivalente: 0.9,
      cantidadComprar: 1,
      sinConversion: false,
    });
  });

  it('unidades distintas pero convertibles se expresan en la unidad de compra', () => {
    const [item] = consolidarLista(
      [ing('a', 'tomate', 1, LB, UNA_LIBRA), ing('b', 'tomate', 453.592, G, UNA_LIBRA)],
      4,
    );
    expect(item).toEqual({
      productoId: 'tomate',
      cantidadRequerida: 2,
      unidadRequeridaId: 'u-lb',
      equivalente: 2,
      cantidadComprar: 2,
      sinConversion: false,
      origenes: [
        { menuDetalleId: 'a', cantidadRequerida: 1 },
        { menuDetalleId: 'b', cantidadRequerida: 1 },
      ],
    });
  });

  it('unidades distintas con alguna sin conversión: no hay cantidad total y se compra al menos 1', () => {
    const [item] = consolidarLista(
      [
        ing('a', 'sal', 1, CUCHARADITA, { cantidad: 500, unidad: G }),
        ing('a', 'sal', 10, G, { cantidad: 500, unidad: G }),
      ],
      4,
    );
    expect(item).toEqual({
      productoId: 'sal',
      cantidadRequerida: null,
      unidadRequeridaId: null,
      equivalente: null,
      cantidadComprar: 1,
      sinConversion: true,
      origenes: [{ menuDetalleId: 'a', cantidadRequerida: null }],
    });
  });

  it('un producto dos veces en la misma comida suma sus cantidades en un solo origen', () => {
    const [item] = consolidarLista(
      [ing('a', 'cebolla', 1, LB, UNA_LIBRA), ing('a', 'cebolla', 0.5, LB, UNA_LIBRA)],
      4,
    );
    expect(item!.origenes).toEqual([{ menuDetalleId: 'a', cantidadRequerida: 1.5 }]);
    expect(item!.cantidadComprar).toBe(2);
  });

  it('sin ingredientes no hay ítems', () => {
    expect(consolidarLista([], 4)).toEqual([]);
  });
});
