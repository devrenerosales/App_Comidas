/**
 * Histórico y variación de precios de un producto por supermercado (M08 · CU-08.3, HU-37):
 * función pura con aritmética entera, así los porcentajes redondean a 1 decimal sin errores de
 * punto flotante. Es la regla que usa la API; la app solo muestra lo que devuelve.
 */
import { diasEntre } from './puntaje';

/** Periodos que se pueden consultar, en semanas (12 por defecto, igual que RF-39). */
export const PERIODOS_SEMANAS = [12, 4] as const;
export type PeriodoSemanas = (typeof PERIODOS_SEMANAS)[number];
export const PERIODO_POR_DEFECTO: PeriodoSemanas = 12;

export type OrigenPrecioHistorico = 'AUTOMATICO' | 'MANUAL' | 'TICKET';

/** Un precio normalizado de un producto en un supermercado. */
export interface PrecioHistorico {
  supermercadoId: string;
  supermercado: string;
  /** Precio por presentación del catálogo ("12.50" o 12.5). */
  precio: string | number;
  /** Fecha del precio, "aaaa-mm-dd". */
  fecha: string;
  origen: OrigenPrecioHistorico;
}

export interface PuntoPrecio {
  fecha: string;
  precioNormalizado: string;
  origen: OrigenPrecioHistorico;
}

export interface Variacion {
  /** Porcentaje con 1 decimal; null si no hay con qué comparar. */
  porcentaje: number | null;
  /** "+4.8 %", "−10.0 %", "0.0 %" o "—". */
  texto: string;
  /** Indicador de subida o baja; null si no hay variación. */
  tendencia: 'SUBE' | 'BAJA' | 'IGUAL' | null;
}

export interface SeriePrecios {
  supermercado: { id: string; nombre: string };
  /** Del más antiguo al más reciente. */
  puntos: PuntoPrecio[];
  /** Último precio contra el anterior. */
  variacionAnterior: Variacion;
  /** Último precio contra el primero del periodo. */
  variacionPeriodo: Variacion;
}

const SIN_VARIACION: Variacion = { porcentaje: null, texto: '—', tendencia: null };

const aCentavos = (precio: string | number): number => Math.round(Number(precio) * 100);

const aDinero = (centavos: number): string =>
  `${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, '0')}`;

/**
 * Variación porcentual = (actual − anterior) ÷ anterior × 100, con 1 decimal (la mitad se
 * aleja de cero). Un anterior de 0 no permite comparar.
 */
export function variacionPorcentual(anterior: string | number, actual: string | number): Variacion {
  const base = aCentavos(anterior);
  if (base <= 0) return SIN_VARIACION;
  const diferencia = aCentavos(actual) - base;
  // Décimas de punto porcentual: (dif ÷ base) × 100 × 10.
  const decimas = Math.sign(diferencia) * Math.round((Math.abs(diferencia) * 1000) / base);
  if (decimas === 0) return { porcentaje: 0, texto: '0.0 %', tendencia: 'IGUAL' };
  const cuerpo = `${Math.floor(Math.abs(decimas) / 10)}.${Math.abs(decimas) % 10} %`;
  return decimas > 0
    ? { porcentaje: decimas / 10, texto: `+${cuerpo}`, tendencia: 'SUBE' }
    : { porcentaje: decimas / 10, texto: `−${cuerpo}`, tendencia: 'BAJA' };
}

/**
 * CU-08.3: de los precios de un producto deja los de las últimas `semanas` semanas, los agrupa
 * por supermercado (alfabético) en orden cronológico y calcula las dos variaciones. Con un solo
 * precio en el periodo las variaciones son "—" (3a); un supermercado sin precios en el periodo
 * no aparece. Sin ningún precio devuelve una lista vacía (E1).
 */
export function seriesDePrecios(
  precios: readonly PrecioHistorico[],
  hoy: string,
  semanas: PeriodoSemanas = PERIODO_POR_DEFECTO,
): SeriePrecios[] {
  const dias = semanas * 7;
  const porSuper = new Map<string, { nombre: string; precios: PrecioHistorico[] }>();
  for (const p of precios) {
    if (diasEntre(p.fecha, hoy) > dias) continue;
    const grupo = porSuper.get(p.supermercadoId) ?? { nombre: p.supermercado, precios: [] };
    grupo.precios.push(p);
    porSuper.set(p.supermercadoId, grupo);
  }
  return [...porSuper.entries()]
    .sort(([, a], [, b]) => a.nombre.localeCompare(b.nombre, 'es'))
    .map(([id, grupo]) => {
      // Orden estable: a igual fecha se respeta el orden en que llegaron.
      const ordenados = [...grupo.precios].sort((a, b) =>
        a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0,
      );
      const primero = ordenados[0]!;
      const ultimo = ordenados[ordenados.length - 1]!;
      const anterior = ordenados.length > 1 ? ordenados[ordenados.length - 2]! : null;
      return {
        supermercado: { id, nombre: grupo.nombre },
        puntos: ordenados.map((p) => ({
          fecha: p.fecha,
          precioNormalizado: aDinero(aCentavos(p.precio)),
          origen: p.origen,
        })),
        variacionAnterior: anterior
          ? variacionPorcentual(anterior.precio, ultimo.precio)
          : SIN_VARIACION,
        variacionPeriodo:
          ordenados.length > 1 ? variacionPorcentual(primero.precio, ultimo.precio) : SIN_VARIACION,
      };
    });
}
