/**
 * Resumen de precios de un producto (M08 · CU-09.2, HU-36): mediana para el costo estimado del
 * menú (RN-01) y mínimo con su supermercado para la compra (CU-07.4). Función pura con
 * aritmética en centavos, así que la mediana de dos precios redondea "mitad hacia arriba" sin
 * errores de punto flotante.
 */
import { diasEntre } from './puntaje';

/** Un precio es vigente hasta 14 días de antigüedad (RN-08). */
export const DIAS_VIGENCIA_PRECIO = 14;

/** Precio normalizado de un producto en un supermercado, con su fecha. */
export interface PrecioDeSupermercado {
  supermercadoId: string;
  supermercado: string;
  /** Precio normalizado a la presentación de compra del catálogo ("12.50" o 12.5). */
  precio: string | number;
  /** Fecha del precio, "aaaa-mm-dd". */
  fecha: string;
}

export interface ResumenPrecios {
  /** Con todos los supermercados que cuentan, para no sesgar el costo estimado. */
  precioMediana: string;
  precioMinimo: string;
  supermercadoMinimoId: string;
  supermercadoMinimo: string;
  fechaPrecioMinimo: string;
  /** Cuántos supermercados entraron en el cálculo (n). */
  cantidadPrecios: number;
  /** Ningún precio vigente: se usaron los últimos conocidos (1a). */
  desactualizado: boolean;
  fechaPrecioMasAntiguo: string;
}

const aCentavos = (precio: string | number): number => Math.round(Number(precio) * 100);

const aDinero = (centavos: number): string =>
  `${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, '0')}`;

/** Mediana en centavos de una lista ya ordenada; con n par, el promedio redondeado hacia arriba. */
function medianaEnCentavos(ordenados: readonly number[]): number {
  const n = ordenados.length;
  const medio = Math.floor(n / 2);
  if (n % 2 === 1) return ordenados[medio]!;
  return Math.floor((ordenados[medio - 1]! + ordenados[medio]! + 1) / 2);
}

/**
 * CU-09.2: de cada supermercado toma el precio más reciente; si alguno es vigente (≤ 14 días)
 * usa solo los vigentes, y si ninguno lo es usa los últimos conocidos y marca el resumen como
 * desactualizado (1a). La mediana usa todos los que cuentan; el mínimo se busca solo entre los
 * supermercados preferidos del hogar (HU-09), con desempate por orden alfabético (3a).
 *
 * `preferidos` es el conjunto de ids de supermercados preferidos, o `null` si el hogar todavía no
 * eligió (valen todos). Si ningún preferido tiene precio, el mínimo sale de todos los que
 * cuentan para no dejar la compra sin sugerencia. Devuelve `null` sin ningún precio (E1).
 */
export function resumenPrecios(
  precios: readonly PrecioDeSupermercado[],
  hoy: string,
  preferidos: ReadonlySet<string> | null = null,
): ResumenPrecios | null {
  // El más reciente por supermercado; a igual fecha gana el que viene primero.
  const ultimoPorSuper = new Map<string, PrecioDeSupermercado>();
  for (const p of precios) {
    const actual = ultimoPorSuper.get(p.supermercadoId);
    if (!actual || p.fecha > actual.fecha) ultimoPorSuper.set(p.supermercadoId, p);
  }
  const ultimos = [...ultimoPorSuper.values()];
  if (ultimos.length === 0) return null;

  const vigentes = ultimos.filter((p) => diasEntre(p.fecha, hoy) <= DIAS_VIGENCIA_PRECIO);
  const desactualizado = vigentes.length === 0;
  const cuentan = desactualizado ? ultimos : vigentes;

  const elegibles = preferidos ? cuentan.filter((p) => preferidos.has(p.supermercadoId)) : cuentan;
  const candidatos = elegibles.length > 0 ? elegibles : cuentan;
  const minimo = [...candidatos].sort(
    (a, b) =>
      aCentavos(a.precio) - aCentavos(b.precio) ||
      a.supermercado.localeCompare(b.supermercado, 'es'),
  )[0]!;

  const ordenados = cuentan.map((p) => aCentavos(p.precio)).sort((a, b) => a - b);
  return {
    precioMediana: aDinero(medianaEnCentavos(ordenados)),
    precioMinimo: aDinero(aCentavos(minimo.precio)),
    supermercadoMinimoId: minimo.supermercadoId,
    supermercadoMinimo: minimo.supermercado,
    fechaPrecioMinimo: minimo.fecha,
    cantidadPrecios: cuentan.length,
    desactualizado,
    fechaPrecioMasAntiguo: cuentan.reduce((a, p) => (p.fecha < a ? p.fecha : a), cuentan[0]!.fecha),
  };
}
