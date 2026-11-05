/**
 * Texto para compartir la lista de compras (M07 · CU-07.5, HU-32): función pura que usa la app,
 * también sin conexión (RNF-04). El texto lleva los productos pendientes con su cantidad; los
 * precios no se incluyen. Si los ítems traen su compra sugerida, el texto sigue la agrupación de
 * la vista "Por supermercado" (HU-31): un bloque por supermercado y, al final, "Sin precio".
 */
import { agruparPorSupermercado, GRUPO_SIN_PRECIO, type CompraSugerida } from './lista-agrupada';

/** Lo que el texto necesita de un ítem vigente de la lista. */
export interface ItemParaTexto {
  producto: { nombre: string };
  /** Presentaciones enteras a comprar ("7", "3"). */
  cantidadComprar: string;
  presentacion: { cantidad: string; unidad: string; unidadCompra: string; texto: string } | null;
  estado: 'PENDIENTE' | 'COMPRADO' | 'YA_LO_TENGO';
  /** Categoría y supermercado sugerido (HU-31); sin ellos el texto es una lista plana. */
  categoria?: string | null;
  compra?: CompraSugerida | null;
}

export interface TextoDeLista {
  /** Texto listo para compartir; vacío si no hay productos que incluir. */
  texto: string;
  /** Cuántos productos lleva el texto. */
  productos: number;
}

const diaMes = (fecha: string): string => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;

/** "7 lb" cuando se compra por libra, "3 × bolsa 2 lb" cuando la presentación trae más contenido. */
export function cantidadDeCompra(
  i: Pick<ItemParaTexto, 'cantidadComprar' | 'presentacion'>,
): string {
  const p = i.presentacion;
  if (!p) return i.cantidadComprar;
  if (p.cantidad === '1' && p.unidadCompra === p.unidad) return `${i.cantidadComprar} ${p.unidad}`;
  return `${i.cantidadComprar} × ${p.texto}`;
}

/**
 * CU-07.5 paso 1: encabezado "Lista de compras 25/10–31/10" y una línea por producto, como
 * "Pollo en piezas — 7 lb", en el orden de la lista. Por defecto solo los pendientes (CA-32.1);
 * con `incluirComprados` van todos, también los comprados y los que ya se tenían (1a).
 */
export function textoDeLista(
  semana: { desde: string; hasta: string },
  items: readonly ItemParaTexto[],
  incluirComprados = false,
): TextoDeLista {
  const incluidos = items.filter((i) => incluirComprados || i.estado === 'PENDIENTE');
  if (incluidos.length === 0) return { texto: '', productos: 0 };
  const encabezado = `Lista de compras ${diaMes(semana.desde)}–${diaMes(semana.hasta)}`;
  const linea = (i: ItemParaTexto) => `${i.producto.nombre} — ${cantidadDeCompra(i)}`;
  if (!incluidos.some((i) => i.compra)) {
    return { texto: [encabezado, ...incluidos.map(linea)].join('\n'), productos: incluidos.length };
  }
  const bloques = agruparPorSupermercado(incluidos).grupos.map((g) => {
    const lineas = g.categorias.flatMap((c) => c.items.map((a) => linea(a.item)));
    return [g.supermercado?.nombre ?? GRUPO_SIN_PRECIO, ...lineas].join('\n');
  });
  return { texto: [encabezado, ...bloques].join('\n\n'), productos: incluidos.length };
}
