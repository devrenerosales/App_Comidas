/**
 * Consolidación de la lista de compras (M07 · CU-07.1, HU-28): funciones puras. Cada ingrediente de
 * cada comida del menú se escala con la Σ de factores de porción (RN-07, D-02), se convierte a la
 * unidad de la presentación de compra del producto, se suma por producto y se redondea hacia arriba
 * a presentaciones enteras.
 */
import { redondear, escalarCantidad, type UnidadMedida } from './catalogo';
import { enPresentacion } from './ajuste';

/** Unidad con su identificador, para devolver a qué unidad de la tabla `unidad` corresponde. */
export type UnidadConId = UnidadMedida & { id: string };

/** Un ingrediente de un platillo programado en una comida del menú. */
export interface IngredienteDeComida {
  /** Detalle del menú (día y tiempo) que programa el platillo. */
  menuDetalleId: string;
  productoId: string;
  /** Cantidad base de la receta, en `unidad`, para las `porcionesBase` del platillo. */
  cantidad: number | string;
  porcionesBase: number;
  unidad: UnidadConId;
  /** Presentación de compra del producto (p. ej. 1 lb). */
  presentacion: { cantidad: number | string; unidad: UnidadConId };
  /** Cantidad de presentación que equivale a 1 `unidad` cuando son de otra magnitud (CU-03.2). */
  equivalencia: number | string | null;
}

/** Lo que una comida aporta a un ítem, en la unidad requerida del ítem (null si no se conoce). */
export interface OrigenDeItem {
  menuDetalleId: string;
  cantidadRequerida: number | null;
}

export interface ItemConsolidado {
  productoId: string;
  /** Total requerido en `unidadRequeridaId`; null si hay unidades sin conversión mezcladas. */
  cantidadRequerida: number | null;
  unidadRequeridaId: string | null;
  /** Lo requerido expresado en la unidad de la presentación (800 g → 1.764 lb); null si no se pudo. */
  equivalente: number | null;
  /** Presentaciones enteras a comprar, al menos 1. */
  cantidadComprar: number;
  /** E1: algún ingrediente no tiene equivalencia entre su unidad y la de compra. */
  sinConversion: boolean;
  origenes: OrigenDeItem[];
}

interface Linea {
  menuDetalleId: string;
  escalada: number;
  unidad: UnidadConId;
  enPresentacion: number | null;
}

/** Suma por comida conservando el orden en que aparecen. */
function porComida(lineas: Linea[], valor: (l: Linea) => number | null): OrigenDeItem[] {
  const mapa = new Map<string, number | null>();
  for (const l of lineas) {
    const v = valor(l);
    const previo = mapa.get(l.menuDetalleId);
    mapa.set(
      l.menuDetalleId,
      v === null || previo === null ? null : redondear((previo ?? 0) + v, 3),
    );
  }
  return [...mapa].map(([menuDetalleId, cantidadRequerida]) => ({
    menuDetalleId,
    cantidadRequerida,
  }));
}

/**
 * CU-07.1 pasos 2 a 6 y 8: ítems consolidados por producto, con las comidas que los originan.
 * - Misma unidad en todas las líneas: lo requerido se muestra en esa unidad (CA-28.2: 800 g) y
 *   `equivalente` trae lo mismo en la unidad de compra (1.764 lb).
 * - Unidades distintas pero convertibles: lo requerido se expresa en la unidad de compra.
 * - Alguna línea sin conversión (E1): el ítem se marca `sinConversion` y se compra al menos 1
 *   presentación; si todas comparten unidad se conserva la cantidad en esa unidad ("1 cucharadita").
 */
export function consolidarLista(
  ingredientes: readonly IngredienteDeComida[],
  sumaFactores: number | string,
): ItemConsolidado[] {
  const porProducto = new Map<string, { lineas: Linea[]; ing: IngredienteDeComida }>();
  for (const i of ingredientes) {
    const escalada = escalarCantidad(i.cantidad, i.porcionesBase, sumaFactores);
    const linea: Linea = {
      menuDetalleId: i.menuDetalleId,
      escalada,
      unidad: i.unidad,
      enPresentacion: enPresentacion(i, escalada),
    };
    const grupo = porProducto.get(i.productoId);
    if (grupo) grupo.lineas.push(linea);
    else porProducto.set(i.productoId, { lineas: [linea], ing: i });
  }

  return [...porProducto].map(([productoId, { lineas, ing }]) => {
    const sinConversion = lineas.some((l) => l.enPresentacion === null);
    const totalPresentacion = redondear(
      lineas.reduce((suma, l) => suma + (l.enPresentacion ?? 0), 0),
      6,
    );
    const contenido = Number(ing.presentacion.cantidad);
    // La presentación siempre tiene contenido mayor que 0 (restricción del catálogo).
    const comprar = Math.max(1, Math.ceil(redondear(totalPresentacion / contenido, 6)));
    const unidades = new Set(lineas.map((l) => l.unidad.id));
    const unidadComun = unidades.size === 1 ? lineas[0]!.unidad : null;

    if (unidadComun) {
      return {
        productoId,
        cantidadRequerida: redondear(
          lineas.reduce((suma, l) => suma + l.escalada, 0),
          3,
        ),
        unidadRequeridaId: unidadComun.id,
        equivalente: sinConversion ? null : redondear(totalPresentacion, 3),
        cantidadComprar: comprar,
        sinConversion,
        origenes: porComida(lineas, (l) => l.escalada),
      };
    }
    if (!sinConversion) {
      return {
        productoId,
        cantidadRequerida: redondear(totalPresentacion, 3),
        unidadRequeridaId: ing.presentacion.unidad.id,
        equivalente: redondear(totalPresentacion, 3),
        cantidadComprar: comprar,
        sinConversion: false,
        origenes: porComida(lineas, (l) => l.enPresentacion),
      };
    }
    return {
      productoId,
      cantidadRequerida: null,
      unidadRequeridaId: null,
      equivalente: null,
      cantidadComprar: comprar,
      sinConversion: true,
      origenes: porComida(lineas, () => null),
    };
  });
}
