/**
 * Despensa según frecuencia (M07 · CU-07.2, HU-29): funciones puras que usan la API y la app para
 * decidir qué productos recurrentes tocan en la lista de una semana y fusionarlos con los
 * ingredientes del menú.
 */
import { redondear } from './catalogo';
import type { ItemConsolidado } from './lista';

export const FRECUENCIAS_DESPENSA = ['SEMANAL', 'QUINCENAL', 'MENSUAL'] as const;
export type FrecuenciaDespensa = (typeof FRECUENCIAS_DESPENSA)[number];

/** Cada cuántas semanas toca un producto de cada frecuencia (RF-29, PA-03). */
export const SEMANAS_POR_FRECUENCIA: Readonly<Record<FrecuenciaDespensa, number>> = {
  SEMANAL: 1,
  QUINCENAL: 2,
  MENSUAL: 4,
};

export const NOMBRE_FRECUENCIA: Readonly<Record<FrecuenciaDespensa, string>> = {
  SEMANAL: 'Semanal',
  QUINCENAL: 'Quincenal',
  MENSUAL: 'Mensual',
};

/** Mensajes en español de CA-29.4. */
export const MENSAJES_DESPENSA = {
  cantidad: 'La cantidad debe ser mayor que 0',
  frecuencia: 'Elige una frecuencia: semanal, quincenal o mensual',
} as const;

/** Origen de un ítem de la lista (RF-28, RF-29). */
export type OrigenItem = 'MENU' | 'DESPENSA' | 'MENU_Y_DESPENSA' | 'MANUAL';

/** Ítem listo para guardar: lo consolidado del menú o lo que aporta la despensa. */
export type ItemDeLista = ItemConsolidado & { origen: OrigenItem };

const MS_POR_DIA = 86_400_000;
const enDias = (fecha: string): number => Date.parse(`${fecha}T00:00:00Z`) / MS_POR_DIA;

export function esFrecuenciaDespensa(valor: unknown): valor is FrecuenciaDespensa {
  return FRECUENCIAS_DESPENSA.includes(valor as FrecuenciaDespensa);
}

/** Semanas completas entre dos fechas AAAA-MM-DD (RN-09: las semanas empiezan el mismo día). */
export function semanasTranscurridas(desde: string, hasta: string): number {
  return Math.floor((enDias(hasta) - enDias(desde)) / 7);
}

/**
 * CU-07.2 pasos 2 y 3: toca si las semanas desde la última inclusión alcanzan el intervalo; sin
 * inclusión previa toca en la primera lista (3a). Una semana ya incluida no vuelve a tocar, así
 * que regenerar la misma semana no avanza la despensa dos veces.
 */
export function despensaToca(
  ultimaInclusionSemana: string | null,
  semana: string,
  frecuencia: FrecuenciaDespensa,
): boolean {
  if (ultimaInclusionSemana === null) return true;
  return semanasTranscurridas(ultimaInclusionSemana, semana) >= SEMANAS_POR_FRECUENCIA[frecuencia];
}

/** Primera semana (AAAA-MM-DD) en que volverá a tocar; null si ya toca en la primera lista. */
export function proximaInclusion(
  ultimaInclusionSemana: string | null,
  frecuencia: FrecuenciaDespensa,
): string | null {
  if (ultimaInclusionSemana === null) return null;
  const dias = enDias(ultimaInclusionSemana) + SEMANAS_POR_FRECUENCIA[frecuencia] * 7;
  return new Date(dias * MS_POR_DIA).toISOString().slice(0, 10);
}

export interface DespensaDeLista {
  productoId: string;
  /** Presentaciones de compra del producto. */
  cantidad: number | string;
}

/**
 * CU-07.2 pasos 4 y 4a: los productos que tocan se agregan con origen "Despensa"; si el producto
 * ya está por los ingredientes del menú se suman las cantidades en una sola línea con origen
 * "Menú + Despensa". El resto de los ítems conserva el origen "Menú".
 */
export function fusionarDespensa(
  items: readonly ItemConsolidado[],
  quetocan: readonly DespensaDeLista[],
): ItemDeLista[] {
  const resultado: ItemDeLista[] = items.map((i) => ({ ...i, origen: 'MENU' }));
  for (const d of quetocan) {
    const cantidad = Number(d.cantidad);
    const existente = resultado.find((i) => i.productoId === d.productoId);
    if (existente) {
      existente.cantidadComprar = redondear(existente.cantidadComprar + cantidad, 3);
      existente.origen = 'MENU_Y_DESPENSA';
    } else {
      resultado.push({
        productoId: d.productoId,
        cantidadRequerida: null,
        unidadRequeridaId: null,
        equivalente: null,
        cantidadComprar: redondear(cantidad, 3),
        sinConversion: false,
        origenes: [],
        origen: 'DESPENSA',
      });
    }
  }
  return resultado;
}
