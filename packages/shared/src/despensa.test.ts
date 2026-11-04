import { describe, expect, it } from 'vitest';
import {
  FRECUENCIAS_DESPENSA,
  MENSAJES_DESPENSA,
  NOMBRE_FRECUENCIA,
  SEMANAS_POR_FRECUENCIA,
  despensaToca,
  esFrecuenciaDespensa,
  fusionarDespensa,
  proximaInclusion,
  semanasTranscurridas,
} from './despensa';
import type { ItemConsolidado } from './lista';

const item = (productoId: string, cantidadComprar: number): ItemConsolidado => ({
  productoId,
  cantidadRequerida: 0.5,
  unidadRequeridaId: 'u-l',
  equivalente: 0.5,
  cantidadComprar,
  sinConversion: false,
  origenes: [{ menuDetalleId: 'd1', cantidadRequerida: 0.5 }],
});

describe('frecuencias de la despensa (RF-29, PA-03)', () => {
  it('semanal toca cada semana, quincenal cada 2 y mensual cada 4', () => {
    expect(SEMANAS_POR_FRECUENCIA).toEqual({ SEMANAL: 1, QUINCENAL: 2, MENSUAL: 4 });
    expect(FRECUENCIAS_DESPENSA).toEqual(['SEMANAL', 'QUINCENAL', 'MENSUAL']);
    expect(NOMBRE_FRECUENCIA.QUINCENAL).toBe('Quincenal');
    expect(MENSAJES_DESPENSA.cantidad).toBe('La cantidad debe ser mayor que 0');
  });

  it('reconoce solo las frecuencias válidas', () => {
    expect(esFrecuenciaDespensa('MENSUAL')).toBe(true);
    for (const malo of ['mensual', 'ANUAL', '', null, undefined, 4]) {
      expect(esFrecuenciaDespensa(malo)).toBe(false);
    }
  });
});

describe('semanasTranscurridas', () => {
  it('cuenta semanas completas entre dos fechas', () => {
    expect(semanasTranscurridas('2026-10-18', '2026-10-25')).toBe(1);
    expect(semanasTranscurridas('2026-10-04', '2026-10-25')).toBe(3);
    expect(semanasTranscurridas('2026-10-25', '2026-10-25')).toBe(0);
    expect(semanasTranscurridas('2026-10-20', '2026-10-25')).toBe(0);
    expect(semanasTranscurridas('2026-11-01', '2026-10-25')).toBe(-1);
  });

  it('cruza el cambio de año y de hora sin desfasarse', () => {
    expect(semanasTranscurridas('2026-12-27', '2027-01-03')).toBe(1);
    expect(semanasTranscurridas('2026-03-01', '2026-11-01')).toBe(35);
  });
});

describe('despensaToca (CA-29.1 y CA-29.3)', () => {
  const semana = '2026-10-25';

  it('CA-29.1 arroz semanal (18/10) y aceite quincenal (11/10) tocan; azúcar mensual (04/10) no', () => {
    expect(despensaToca('2026-10-18', semana, 'SEMANAL')).toBe(true);
    expect(despensaToca('2026-10-11', semana, 'QUINCENAL')).toBe(true);
    expect(despensaToca('2026-10-04', semana, 'MENSUAL')).toBe(false);
  });

  it('el mensual toca al cumplirse la cuarta semana', () => {
    expect(despensaToca('2026-09-27', semana, 'MENSUAL')).toBe(true);
  });

  it('CA-29.3 sin inclusión previa toca en la primera lista', () => {
    expect(despensaToca(null, semana, 'MENSUAL')).toBe(true);
  });

  it('una semana ya incluida no vuelve a tocar (no avanza dos veces)', () => {
    for (const f of FRECUENCIAS_DESPENSA) expect(despensaToca(semana, semana, f)).toBe(false);
  });
});

describe('proximaInclusion', () => {
  it('es la semana en que volverá a tocar', () => {
    expect(proximaInclusion('2026-10-25', 'SEMANAL')).toBe('2026-11-01');
    expect(proximaInclusion('2026-10-25', 'QUINCENAL')).toBe('2026-11-08');
    expect(proximaInclusion('2026-10-25', 'MENSUAL')).toBe('2026-11-22');
    expect(proximaInclusion('2026-12-20', 'MENSUAL')).toBe('2027-01-17');
  });

  it('sin inclusión previa no hay fecha: toca en la primera lista', () => {
    expect(proximaInclusion(null, 'SEMANAL')).toBeNull();
  });
});

describe('fusionarDespensa (CA-29.1 y CA-29.2)', () => {
  it('CA-29.2 el aceite del menú y el de la despensa quedan en una línea "Menú + Despensa" con 2 botellas', () => {
    const r = fusionarDespensa([item('aceite', 1)], [{ productoId: 'aceite', cantidad: '1.000' }]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      productoId: 'aceite',
      cantidadComprar: 2,
      origen: 'MENU_Y_DESPENSA',
      origenes: [{ menuDetalleId: 'd1', cantidadRequerida: 0.5 }],
    });
  });

  it('CA-29.1 un producto que solo trae la despensa se agrega con origen "Despensa" y sin comidas', () => {
    const r = fusionarDespensa(
      [item('pollo', 7)],
      [
        { productoId: 'arroz', cantidad: 2 },
        { productoId: 'aceite', cantidad: 1 },
      ],
    );
    expect(r.map((i) => [i.productoId, i.cantidadComprar, i.origen])).toEqual([
      ['pollo', 7, 'MENU'],
      ['arroz', 2, 'DESPENSA'],
      ['aceite', 1, 'DESPENSA'],
    ]);
    expect(r[1]).toMatchObject({
      cantidadRequerida: null,
      unidadRequeridaId: null,
      equivalente: null,
      sinConversion: false,
      origenes: [],
    });
  });

  it('suma presentaciones fraccionarias a 3 decimales y no modifica lo recibido', () => {
    const original = item('aceite', 1);
    const r = fusionarDespensa([original], [{ productoId: 'aceite', cantidad: 0.1 + 0.2 }]);
    expect(r[0]!.cantidadComprar).toBe(1.3);
    expect(original.cantidadComprar).toBe(1);
    expect(original).not.toHaveProperty('origen');
  });

  it('sin despensa que toque deja todo con origen "Menú"', () => {
    const r = fusionarDespensa([item('pollo', 7)], []);
    expect(r).toEqual([{ ...item('pollo', 7), origen: 'MENU' }]);
    expect(fusionarDespensa([], [])).toEqual([]);
  });
});
