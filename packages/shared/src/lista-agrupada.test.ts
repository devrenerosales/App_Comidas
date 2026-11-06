import { describe, expect, it } from 'vitest';
import {
  agruparPorSupermercado,
  CATEGORIA_SIN_CLASIFICAR,
  type CompraSugerida,
  type ItemAgrupable,
} from './lista-agrupada';
import { textoDeLista, type ItemParaTexto } from './lista-texto';

const WALMART = { id: 'walmart', nombre: 'Walmart' };
const PAIZ = { id: 'paiz', nombre: 'Paiz' };

const compra = (
  supermercado: CompraSugerida['supermercado'],
  precio: string,
  fecha = '2026-10-24',
  desactualizado = false,
): CompraSugerida => ({ supermercado, precio, fecha, desactualizado });

const item = (
  nombre: string,
  cantidadComprar: string,
  categoria: string | null,
  c: CompraSugerida | null,
): ItemAgrupable => ({ producto: { nombre }, cantidadComprar, categoria, compra: c });

describe('agruparPorSupermercado (HU-31)', () => {
  it('CA-31.1 asigna cada producto al supermercado más barato con subtotales y total', () => {
    const r = agruparPorSupermercado([
      item('Arroz blanco 2 lb', '2', 'Granos', compra(WALMART, '12.50')),
      item('Pollo en piezas', '7', 'Carnes', compra(PAIZ, '21.90')),
      item('Tomate', '2', 'Verduras', compra(PAIZ, '6.25')),
    ]);

    expect(r.grupos.map((g) => g.supermercado?.nombre)).toEqual(['Paiz', 'Walmart']);
    const [paiz, walmart] = r.grupos;
    expect(walmart!.subtotal).toBe('25.00');
    expect(walmart!.categorias[0]!.items[0]!.costo).toBe('25.00');
    expect(paiz!.categorias.map((c) => c.categoria)).toEqual(['Carnes', 'Verduras']);
    expect(paiz!.categorias[0]!.items[0]!.costo).toBe('153.30');
    expect(paiz!.categorias[1]!.items[0]!.costo).toBe('12.50');
    expect(paiz!.subtotal).toBe('165.80');
    expect(r.total).toBe('190.80');
  });

  it('CA-31.2 un precio no vigente lleva la advertencia con su fecha y sí suma', () => {
    const r = agruparPorSupermercado([
      item('Aceite 1 L', '1', 'Despensa', compra(WALMART, '24.95', '2026-10-03', true)),
    ]);
    const [g] = r.grupos;
    expect(g!.supermercado).toEqual(WALMART);
    expect(g!.categorias[0]!.items[0]).toMatchObject({
      costo: '24.95',
      advertencia: 'Precio del 03/10/2026',
    });
    expect(r.total).toBe('24.95');
  });

  it('un precio vigente no lleva advertencia', () => {
    const r = agruparPorSupermercado([item('Arroz', '1', 'Granos', compra(WALMART, '12.50'))]);
    expect(r.grupos[0]!.categorias[0]!.items[0]!.advertencia).toBeNull();
  });

  it('CA-31.4 sin precio va al grupo "Sin precio", al final, y no suma', () => {
    const r = agruparPorSupermercado([
      item('Tortillas', '1', null, null),
      { producto: { nombre: 'Sal' }, cantidadComprar: '1' },
      item('Arroz', '1', 'Granos', compra(WALMART, '12.50')),
    ]);
    expect(r.grupos.map((g) => g.supermercado?.nombre ?? null)).toEqual(['Walmart', null]);
    const sin = r.grupos[1]!;
    expect(sin.subtotal).toBeNull();
    expect(sin.categorias).toHaveLength(1);
    expect(sin.categorias[0]!.categoria).toBe(CATEGORIA_SIN_CLASIFICAR);
    expect(sin.categorias[0]!.items.map((a) => [a.item.producto.nombre, a.costo])).toEqual([
      ['Sal', null],
      ['Tortillas', null],
    ]);
    expect(r.total).toBe('12.50');
  });

  it('suma en centavos sin errores de punto flotante', () => {
    const r = agruparPorSupermercado([
      item('A', '3', 'X', compra(WALMART, '0.10')),
      item('B', '1', 'X', compra(WALMART, '0.20')),
    ]);
    expect(r.grupos[0]!.subtotal).toBe('0.50');
    expect(r.total).toBe('0.50');
  });

  it('ordena categorías y productos alfabéticamente dentro del supermercado', () => {
    const r = agruparPorSupermercado([
      item('Zanahoria', '1', 'Verduras', compra(PAIZ, '3.00')),
      item('Arroz', '1', 'Granos', compra(PAIZ, '3.00')),
      item('Ajo', '1', 'Verduras', compra(PAIZ, '3.00')),
    ]);
    const [g] = r.grupos;
    expect(g!.categorias.map((c) => c.categoria)).toEqual(['Granos', 'Verduras']);
    expect(g!.categorias[1]!.items.map((a) => a.item.producto.nombre)).toEqual([
      'Ajo',
      'Zanahoria',
    ]);
  });

  it('una lista vacía no tiene grupos y suma cero', () => {
    expect(agruparPorSupermercado([])).toEqual({ grupos: [], total: '0.00' });
  });
});

describe('textoDeLista agrupado (HU-31 + HU-32)', () => {
  const SEMANA = { desde: '2026-10-25', hasta: '2026-10-31' };
  const LB = { cantidad: '1', unidad: 'lb', unidadCompra: 'lb', texto: 'lb 1 lb' };
  const paraTexto = (
    nombre: string,
    cantidad: string,
    categoria: string | null,
    c: CompraSugerida | null,
    estado: ItemParaTexto['estado'] = 'PENDIENTE',
  ): ItemParaTexto => ({
    producto: { nombre },
    cantidadComprar: cantidad,
    presentacion: LB,
    estado,
    categoria,
    compra: c,
  });

  it('un bloque por supermercado y "Sin precio" al final, sin precios', () => {
    const { texto, productos } = textoDeLista(SEMANA, [
      paraTexto('Pollo en piezas', '7', 'Carnes', compra(PAIZ, '21.90')),
      paraTexto('Arroz', '2', 'Granos', compra(WALMART, '12.50')),
      paraTexto('Tortillas', '1', null, null),
    ]);
    expect(productos).toBe(3);
    expect(texto).toBe(
      [
        'Lista de compras 25/10–31/10',
        '',
        'Paiz',
        'Pollo en piezas — 7 lb',
        '',
        'Walmart',
        'Arroz — 2 lb',
        '',
        'Sin precio',
        'Tortillas — 1 lb',
      ].join('\n'),
    );
    expect(texto).not.toContain('21.90');
  });

  it('sigue dejando fuera los comprados salvo que se pidan', () => {
    const items = [
      paraTexto('Arroz', '2', 'Granos', compra(WALMART, '12.50')),
      paraTexto('Sal', '1', 'Granos', compra(WALMART, '5.00'), 'COMPRADO'),
    ];
    expect(textoDeLista(SEMANA, items).texto).not.toContain('Sal');
    expect(textoDeLista(SEMANA, items, true).texto).toContain('Sal — 1 lb');
  });

  it('sin ninguna compra sugerida el texto sigue siendo una lista plana', () => {
    const { texto } = textoDeLista(SEMANA, [paraTexto('Arroz', '2', 'Granos', null)]);
    expect(texto).toBe('Lista de compras 25/10–31/10\nArroz — 2 lb');
  });
});
