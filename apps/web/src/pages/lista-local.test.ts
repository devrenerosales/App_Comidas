import type { CambioLista } from '@menu/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ItemLista, ListaCompras } from '../api/listas';
import { aplicarCambioLocal, guardarLocal, leerLocal, listaVisible } from './lista-local';

const item = (id: string, extra: Partial<ItemLista> = {}): ItemLista => ({
  id,
  producto: { id: `p-${id}`, nombre: `Producto ${id}` },
  cantidadRequerida: null,
  equivalente: null,
  cantidadComprar: '7',
  presentacion: null,
  origen: 'MENU',
  estado: 'PENDIENTE',
  sinConversion: false,
  comidas: [],
  ...extra,
});

const lista = (items: ItemLista[]): ListaCompras => ({
  id: 'l1',
  menuId: 'm1',
  semana: { desde: '2026-11-01', hasta: '2026-11-07' },
  version: 1,
  excede: null,
  total: items.length,
  comprados: items.filter((i) => i.estado !== 'PENDIENTE').length,
  sinConversion: 0,
  items,
});

const cambio = (
  operacion: CambioLista['operacion'],
  itemId: string,
  datos: CambioLista['datos'] = null,
): CambioLista => ({
  id: `c-${operacion}-${itemId}`,
  itemId,
  operacion,
  datos,
  marcaTiempo: '2026-11-03T10:00:00.000Z',
});

describe('aplicarCambioLocal (CU-07.3)', () => {
  it('marcar comprado cambia el estado y el contador', () => {
    const r = aplicarCambioLocal(lista([item('a'), item('b')]), cambio('MARCAR_COMPRADO', 'a'));
    expect(r.items.map((i) => i.estado)).toEqual(['COMPRADO', 'PENDIENTE']);
    expect(r).toMatchObject({ total: 2, comprados: 1 });
  });

  it('"Ya lo tengo" cuenta como cubierto y desmarcar lo devuelve a pendiente', () => {
    const cubierto = aplicarCambioLocal(lista([item('a')]), cambio('MARCAR_YA_LO_TENGO', 'a'));
    expect(cubierto).toMatchObject({ comprados: 1 });
    expect(cubierto.items[0]!.estado).toBe('YA_LO_TENGO');
    const libre = aplicarCambioLocal(cubierto, cambio('DESMARCAR_COMPRADO', 'a'));
    expect(libre).toMatchObject({ comprados: 0 });
    expect(libre.items[0]!.estado).toBe('PENDIENTE');
  });

  it('quitar saca el ítem de la lista', () => {
    const r = aplicarCambioLocal(lista([item('a'), item('b')]), cambio('ELIMINAR', 'a'));
    expect(r.items.map((i) => i.id)).toEqual(['b']);
    expect(r.total).toBe(1);
  });

  it('agregar crea un ítem de texto libre pendiente al final', () => {
    const r = aplicarCambioLocal(
      lista([item('a')]),
      cambio('AGREGAR', 'nuevo', { textoLibre: 'Tortillas', cantidadComprar: 30 }),
    );
    expect(r.items[1]).toEqual({
      id: 'nuevo',
      producto: { id: null, nombre: 'Tortillas' },
      cantidadRequerida: null,
      equivalente: null,
      cantidadComprar: '30',
      presentacion: null,
      origen: 'MANUAL',
      estado: 'PENDIENTE',
      sinConversion: false,
      comidas: [],
    });
    expect(r.total).toBe(2);
  });

  it('agregar un producto del catálogo conserva su id', () => {
    const r = aplicarCambioLocal(
      lista([]),
      cambio('AGREGAR', 'nuevo', { productoId: 'cat-1', cantidadComprar: 2 }),
    );
    expect(r.items[0]!.producto).toEqual({ id: 'cat-1', nombre: '' });
  });

  it('actualizar cambia solo la cantidad del ítem indicado', () => {
    const r = aplicarCambioLocal(
      lista([item('a'), item('b')]),
      cambio('ACTUALIZAR', 'b', { cantidadComprar: 9 }),
    );
    expect(r.items.map((i) => i.cantidadComprar)).toEqual(['7', '9']);
  });

  it('un cambio que no aplica (cantidad inválida o ítem inexistente) deja la lista igual', () => {
    const base = lista([item('a')]);
    expect(aplicarCambioLocal(base, cambio('ACTUALIZAR', 'a', { cantidadComprar: 0 }))).toBe(base);
    expect(aplicarCambioLocal(base, cambio('MARCAR_COMPRADO', 'inexistente'))).toBe(base);
  });
});

describe('aplicarCambioLocal con precio (CU-07.7)', () => {
  it('marcar comprado con precio lo guarda y suma al gasto sugerido', () => {
    const r = aplicarCambioLocal(
      lista([item('a'), item('b')]),
      cambio('MARCAR_COMPRADO', 'a', { precioReal: '28.10', contenidoComprado: 5 }),
    );
    expect(r.items[0]).toMatchObject({
      estado: 'COMPRADO',
      precioReal: '28.10',
      contenidoComprado: '5',
      precioNormalizado: null,
    });
    expect(r.gastoSugerido).toBe('28.10');
  });

  it('registrar o corregir el precio de un comprado actualiza el gasto y borrarlo lo quita', () => {
    const comprado = aplicarCambioLocal(
      lista([item('a'), item('b')]),
      cambio('MARCAR_COMPRADO', 'a'),
    );
    const conPrecio = aplicarCambioLocal(
      comprado,
      cambio('REGISTRAR_PRECIO', 'a', { precioReal: 54 }),
    );
    expect(conPrecio.items[0]!.precioReal).toBe('54.00');
    const dos = aplicarCambioLocal(
      aplicarCambioLocal(conPrecio, cambio('MARCAR_COMPRADO', 'b', { precioReal: 45.5 })),
      cambio('REGISTRAR_PRECIO', 'a', { precioReal: 50 }),
    );
    expect(dos.gastoSugerido).toBe('95.50');
    const sinPrecio = aplicarCambioLocal(dos, cambio('REGISTRAR_PRECIO', 'a'));
    expect(sinPrecio.items[0]).toMatchObject({ precioReal: null, contenidoComprado: null });
    expect(sinPrecio.gastoSugerido).toBe('45.50');
  });

  it('desmarcar o pasar a "Ya lo tengo" descarta el precio', () => {
    const comprado = aplicarCambioLocal(
      lista([item('a')]),
      cambio('MARCAR_COMPRADO', 'a', { precioReal: 10 }),
    );
    for (const operacion of ['DESMARCAR_COMPRADO', 'MARCAR_YA_LO_TENGO'] as const) {
      const r = aplicarCambioLocal(comprado, cambio(operacion, 'a'));
      expect(r.items[0]).toMatchObject({ precioReal: null, contenidoComprado: null });
      expect(r.gastoSugerido).toBe('0.00');
    }
  });

  it('un precio inválido no cambia la lista', () => {
    const base = lista([item('a')]);
    expect(aplicarCambioLocal(base, cambio('MARCAR_COMPRADO', 'a', { precioReal: '12.345' }))).toBe(
      base,
    );
  });
});

describe('listaVisible', () => {
  it('aplica la cola en orden sobre la lista del servidor', () => {
    const visible = listaVisible({
      base: lista([item('a'), item('b')]),
      cola: [cambio('MARCAR_COMPRADO', 'a'), cambio('ELIMINAR', 'b')],
    });
    expect(visible.items.map((i) => [i.id, i.estado])).toEqual([['a', 'COMPRADO']]);
    expect(visible).toMatchObject({ total: 1, comprados: 1 });
  });
});

describe('copia local', () => {
  const almacen = new Map<string, string>();

  beforeEach(() => {
    almacen.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => almacen.get(k) ?? null,
      setItem: (k: string, v: string) => void almacen.set(k, v),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('guarda y lee la lista con su cola', () => {
    const estado = { base: lista([item('a')]), cola: [cambio('MARCAR_COMPRADO', 'a')] };
    guardarLocal('l1', estado);
    expect(leerLocal('l1')).toEqual(estado);
  });

  it('sin copia, con un formato inválido o sin almacenamiento devuelve null', () => {
    expect(leerLocal('l1')).toBeNull();
    almacen.set('mf.lista.l1', 'no es json');
    expect(leerLocal('l1')).toBeNull();
    almacen.set('mf.lista.l1', JSON.stringify({ base: null, cola: [] }));
    expect(leerLocal('l1')).toBeNull();
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    });
    expect(leerLocal('l1')).toBeNull();
    expect(() => guardarLocal('l1', { base: lista([]), cola: [] })).not.toThrow();
  });
});
