import { describe, expect, it } from 'vitest';
import { avanceDeLista, type ComidaDelMenu, type ItemParaAvance } from './avance';

const comida = (
  menuDetalleId: string,
  fecha: string,
  nombre: string | null,
  tiempo: ComidaDelMenu['tiempo'] = 'ALMUERZO',
): ComidaDelMenu => ({
  menuDetalleId,
  fecha,
  tiempo,
  platillo: nombre ? { id: `p-${menuDetalleId}`, nombre } : null,
});

const item = (
  id: string,
  producto: string,
  estado: ItemParaAvance['estado'],
  comidas: string[],
): ItemParaAvance => ({ id, producto, estado, comidas });

const PEPIAN = ['Pollo en piezas', 'Miltomate', 'Tomate', 'Cebolla', 'Pepitoria', 'Ajonjolí'];

/** Pepián de pollo (miércoles) con 6 ingredientes en la lista (CA-43.1). */
const itemsPepian = (cubiertos: string[]) =>
  PEPIAN.map((p, i) => item(`i${i}`, p, cubiertos.includes(p) ? 'COMPRADO' : 'PENDIENTE', ['mie']));

describe('avanceDeLista (CU-07.6, HU-43)', () => {
  it('CA-43.1 una comida con 4 de 6 ingredientes comprados no está lista y lista los pendientes', () => {
    const a = avanceDeLista(itemsPepian(['Pollo en piezas', 'Miltomate', 'Tomate', 'Cebolla']), [
      comida('mie', '2026-10-28', 'Pepián de pollo'),
    ]);
    expect(a.comidas).toEqual([
      {
        menuDetalleId: 'mie',
        fecha: '2026-10-28',
        tiempo: 'ALMUERZO',
        platillo: { id: 'p-mie', nombre: 'Pepián de pollo' },
        cubiertos: 4,
        total: 6,
        listaParaPreparar: false,
        sinIngredientes: false,
        pendientes: [
          { itemId: 'i4', producto: 'Pepitoria' },
          { itemId: 'i5', producto: 'Ajonjolí' },
        ],
      },
    ]);
  });

  it('CA-43.2 "Ya lo tengo" cuenta como cubierto y completa la comida', () => {
    const items = itemsPepian(PEPIAN.slice(0, 5));
    items[5] = item('i5', 'Ajonjolí', 'YA_LO_TENGO', ['mie']);
    const a = avanceDeLista(items, [comida('mie', '2026-10-28', 'Pepián de pollo')]);
    expect(a.comidas[0]).toMatchObject({
      cubiertos: 6,
      total: 6,
      listaParaPreparar: true,
      pendientes: [],
    });
  });

  it('CA-43.3 un producto compartido cuenta para todas sus comidas', () => {
    const comidas = [
      comida('a', '2026-10-26', 'Pepián de pollo'),
      comida('b', '2026-10-27', 'Carne guisada'),
      comida('c', '2026-10-28', 'Caldo de res'),
    ];
    const antes = [
      item('x', 'Cebolla', 'PENDIENTE', ['a', 'b', 'c']),
      item('y', 'Papa', 'COMPRADO', ['b']),
    ];
    const despues = [{ ...antes[0]!, estado: 'COMPRADO' as const }, antes[1]!];
    expect(avanceDeLista(antes, comidas).comidas.map((c) => [c.cubiertos, c.total])).toEqual([
      [0, 1],
      [1, 2],
      [0, 1],
    ]);
    expect(avanceDeLista(despues, comidas).comidas.map((c) => [c.cubiertos, c.total])).toEqual([
      [1, 1],
      [2, 2],
      [1, 1],
    ]);
  });

  it('CA-43.4 el avance general redondea el porcentaje: 18 de 31 es 58 %', () => {
    const items = Array.from({ length: 31 }, (_, i) =>
      item(`i${i}`, `P${i}`, i < 15 ? 'COMPRADO' : i < 18 ? 'YA_LO_TENGO' : 'PENDIENTE', []),
    );
    expect(avanceDeLista(items, []).general).toEqual({ cubiertos: 18, total: 31, porcentaje: 58 });
  });

  it('el porcentaje redondea hacia arriba en la mitad y es 0 si no hay productos', () => {
    const items = [item('a', 'A', 'COMPRADO', []), item('b', 'B', 'PENDIENTE', [])];
    expect(avanceDeLista(items, []).general.porcentaje).toBe(50);
    const ochos = Array.from({ length: 8 }, (_, i) =>
      item(`i${i}`, `P${i}`, i === 0 ? 'COMPRADO' : 'PENDIENTE', []),
    );
    expect(avanceDeLista(ochos, []).general.porcentaje).toBe(13);
    expect(avanceDeLista([], []).general).toEqual({ cubiertos: 0, total: 0, porcentaje: 0 });
  });

  it('CA-43.6 desmarcar un ingrediente de una comida lista le quita la marca', () => {
    const comidas = [comida('p', '2026-10-30', 'Pescado frito')];
    const lista = (limon: ItemParaAvance['estado']) => [
      item('a', 'Pescado', 'COMPRADO', ['p']),
      item('b', 'Harina', 'COMPRADO', ['p']),
      item('c', 'Aceite', 'YA_LO_TENGO', ['p']),
      item('d', 'Limón', limon, ['p']),
    ];
    expect(avanceDeLista(lista('COMPRADO'), comidas).comidas[0]).toMatchObject({
      cubiertos: 4,
      total: 4,
      listaParaPreparar: true,
    });
    expect(avanceDeLista(lista('PENDIENTE'), comidas).comidas[0]).toMatchObject({
      cubiertos: 3,
      total: 4,
      listaParaPreparar: false,
      pendientes: [{ itemId: 'd', producto: 'Limón' }],
    });
  });

  it('E1 un ítem agregado a mano cuenta solo en el avance general', () => {
    const a = avanceDeLista(
      [item('a', 'Pollo', 'COMPRADO', ['mie']), item('t', 'Tortillas', 'COMPRADO', [])],
      [comida('mie', '2026-10-28', 'Pepián de pollo')],
    );
    expect(a.general).toMatchObject({ cubiertos: 2, total: 2 });
    expect(a.comidas[0]).toMatchObject({ cubiertos: 1, total: 1 });
  });

  it('E2 un platillo sin ingredientes en la lista nunca queda "lista para preparar"', () => {
    const a = avanceDeLista([], [comida('mie', '2026-10-28', 'Arroz blanco')]);
    expect(a.comidas[0]).toMatchObject({
      cubiertos: 0,
      total: 0,
      sinIngredientes: true,
      listaParaPreparar: false,
      pendientes: [],
    });
  });

  it('los espacios sin platillo no son comidas y las comidas salen por fecha y tiempo', () => {
    const a = avanceDeLista(
      [],
      [
        comida('cena', '2026-10-26', 'Caldo', 'CENA'),
        comida('vacio', '2026-10-25', null),
        comida('lun', '2026-10-27', 'Carne'),
        comida('alm', '2026-10-26', 'Pollo'),
        comida('des', '2026-10-26', 'Huevos', 'DESAYUNO'),
      ],
    );
    expect(a.comidas.map((c) => c.menuDetalleId)).toEqual(['des', 'alm', 'cena', 'lun']);
  });
});
