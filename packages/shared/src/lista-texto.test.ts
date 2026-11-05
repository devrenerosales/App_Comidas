import { describe, expect, it } from 'vitest';
import { cantidadDeCompra, textoDeLista, type ItemParaTexto } from './lista-texto';

const LB = { cantidad: '1', unidad: 'lb', unidadCompra: 'lb', texto: 'lb 1 lb' };

const item = (
  nombre: string,
  cantidadComprar: string,
  estado: ItemParaTexto['estado'] = 'PENDIENTE',
  presentacion: ItemParaTexto['presentacion'] = LB,
): ItemParaTexto => ({ producto: { nombre }, cantidadComprar, presentacion, estado });

const SEMANA = { desde: '2026-10-25', hasta: '2026-10-31' };

describe('cantidadDeCompra', () => {
  it('"7 lb" cuando se compra por libra', () => {
    expect(cantidadDeCompra(item('Pollo en piezas', '7'))).toBe('7 lb');
  });

  it('"3 × bolsa 2 lb" cuando la presentación trae más contenido', () => {
    const bolsa = { cantidad: '2', unidad: 'lb', unidadCompra: 'bolsa', texto: 'bolsa 2 lb' };
    expect(cantidadDeCompra(item('Arroz', '3', 'PENDIENTE', bolsa))).toBe('3 × bolsa 2 lb');
  });

  it('una unidad de compra distinta de la de contenido lleva la presentación', () => {
    const botella = { cantidad: '1', unidad: 'L', unidadCompra: 'botella', texto: 'botella 1 L' };
    expect(cantidadDeCompra(item('Aceite', '2', 'PENDIENTE', botella))).toBe('2 × botella 1 L');
  });

  it('sin presentación (texto libre) solo la cantidad', () => {
    expect(cantidadDeCompra(item('Tortillas', '2', 'PENDIENTE', null))).toBe('2');
  });
});

describe('textoDeLista (CA-32.1 y CA-32.3)', () => {
  const lista = [
    item('Pollo en piezas', '7'),
    item('Arroz', '2', 'COMPRADO'),
    item('Tomate', '3'),
    item('Sal', '1', 'YA_LO_TENGO'),
  ];

  it('CA-32.1 encabezado con las fechas y solo los pendientes con su cantidad', () => {
    expect(textoDeLista(SEMANA, lista)).toEqual({
      texto: 'Lista de compras 25/10–31/10\nPollo en piezas — 7 lb\nTomate — 3 lb',
      productos: 2,
    });
  });

  it('1a "Incluir comprados" agrega todos los productos, también los que ya se tenían', () => {
    const r = textoDeLista(SEMANA, lista, true);
    expect(r.productos).toBe(4);
    expect(r.texto.split('\n')).toEqual([
      'Lista de compras 25/10–31/10',
      'Pollo en piezas — 7 lb',
      'Arroz — 2 lb',
      'Tomate — 3 lb',
      'Sal — 1 lb',
    ]);
  });

  it('no incluye precios aunque el ítem los tenga', () => {
    const conPrecio = { ...item('Arroz', '2'), precioReal: '28.10' } as ItemParaTexto;
    expect(textoDeLista(SEMANA, [conPrecio]).texto).not.toContain('28.10');
  });

  it('CA-32.3 sin pendientes no hay texto, pero con "Incluir comprados" sí', () => {
    const comprados = [item('Arroz', '2', 'COMPRADO'), item('Sal', '1', 'YA_LO_TENGO')];
    expect(textoDeLista(SEMANA, comprados)).toEqual({ texto: '', productos: 0 });
    expect(textoDeLista(SEMANA, comprados, true).productos).toBe(2);
  });

  it('una lista vacía no tiene texto', () => {
    expect(textoDeLista(SEMANA, [], true)).toEqual({ texto: '', productos: 0 });
  });

  it('cruza el fin de mes', () => {
    expect(textoDeLista({ desde: '2026-11-29', hasta: '2026-12-05' }, lista).texto).toMatch(
      /^Lista de compras 29\/11–05\/12\n/,
    );
  });
});
