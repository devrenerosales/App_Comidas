/**
 * Lista de compras agrupada por supermercado y categoría (M07 · CU-07.4, HU-31): función pura con
 * aritmética en centavos que usa la app, también sin conexión (RNF-04). Es una vista: no cambia
 * los ítems ni sus marcas de comprado.
 */

/** Compra sugerida de un producto: el supermercado del precio mínimo y ese precio (CU-09.2). */
export interface CompraSugerida {
  supermercado: { id: string; nombre: string };
  /** Precio por presentación del catálogo ("12.50"). */
  precio: string;
  /** Fecha del precio, "aaaa-mm-dd". */
  fecha: string;
  /** Ningún precio vigente (> 14 días): se usó el último conocido (RN-08). */
  desactualizado: boolean;
}

/** Lo que la agrupación necesita de un ítem. */
export interface ItemAgrupable {
  producto: { nombre: string };
  /** Presentaciones enteras a comprar ("2", "7"). */
  cantidadComprar: string;
  /** Categoría del producto; null en los ítems de texto libre. */
  categoria?: string | null;
  /** null si el producto no tiene ningún precio o es texto libre. */
  compra?: CompraSugerida | null;
}

export interface ItemAgrupado<T extends ItemAgrupable> {
  item: T;
  /** Cantidad a comprar × precio; null sin precio (no suma a ningún subtotal). */
  costo: string | null;
  /** "Precio del 03/10/2026" cuando el precio ya no es vigente. */
  advertencia: string | null;
}

export interface GrupoCategoria<T extends ItemAgrupable> {
  categoria: string;
  items: ItemAgrupado<T>[];
}

export interface GrupoSupermercado<T extends ItemAgrupable> {
  /** null es el grupo "Sin precio". */
  supermercado: { id: string; nombre: string } | null;
  /** null en "Sin precio". */
  subtotal: string | null;
  categorias: GrupoCategoria<T>[];
}

export interface ListaAgrupada<T extends ItemAgrupable> {
  grupos: GrupoSupermercado<T>[];
  /** Suma de los subtotales; lo "Sin precio" no entra. */
  total: string;
}

/** Nombre del grupo de lo que no tiene ningún precio. */
export const GRUPO_SIN_PRECIO = 'Sin precio';
/** Categoría de los ítems que no son del catálogo. */
export const CATEGORIA_SIN_CLASIFICAR = 'Otros';

const aCentavos = (valor: string | number): number => Math.round(Number(valor) * 100);

const aDinero = (centavos: number): string =>
  `${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, '0')}`;

/** "2026-10-03" → "03/10/2026". */
const fechaCompleta = (fecha: string): string =>
  `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}/${fecha.slice(0, 4)}`;

const porNombre = (a: string, b: string): number => a.localeCompare(b, 'es');

/**
 * CU-07.4: asigna cada ítem al supermercado de su precio mínimo (el que ya resolvió el resumen de
 * precios, con preferidos y desempate) y lo agrupa por categoría dentro de cada supermercado.
 * El costo del ítem es la cantidad a comprar por ese precio y el subtotal suma los costos. Lo que
 * no tiene precio va al grupo "Sin precio", al final, y no suma. Supermercados, categorías y
 * productos van en orden alfabético.
 */
export function agruparPorSupermercado<T extends ItemAgrupable>(
  items: readonly T[],
): ListaAgrupada<T> {
  const grupos = new Map<string | null, { nombre: string | null; items: ItemAgrupado<T>[] }>();
  for (const item of items) {
    const compra = item.compra ?? null;
    const costo = compra ? aCentavos(compra.precio) * Number(item.cantidadComprar) : null;
    const agrupado: ItemAgrupado<T> = {
      item,
      costo: costo === null ? null : aDinero(Math.round(costo)),
      advertencia: compra?.desactualizado ? `Precio del ${fechaCompleta(compra.fecha)}` : null,
    };
    const clave = compra ? compra.supermercado.id : null;
    const grupo = grupos.get(clave) ?? { nombre: compra?.supermercado.nombre ?? null, items: [] };
    grupo.items.push(agrupado);
    grupos.set(clave, grupo);
  }

  let total = 0;
  const resultado = [...grupos.entries()].map(([id, grupo]): GrupoSupermercado<T> => {
    const subtotal = grupo.items.reduce((suma, i) => suma + (i.costo ? aCentavos(i.costo) : 0), 0);
    if (id !== null) total += subtotal;
    const categorias = new Map<string, ItemAgrupado<T>[]>();
    for (const agrupado of grupo.items) {
      const nombre = agrupado.item.categoria ?? CATEGORIA_SIN_CLASIFICAR;
      categorias.set(nombre, [...(categorias.get(nombre) ?? []), agrupado]);
    }
    return {
      supermercado: id === null ? null : { id, nombre: grupo.nombre! },
      subtotal: id === null ? null : aDinero(subtotal),
      categorias: [...categorias.entries()]
        .sort(([a], [b]) => porNombre(a, b))
        .map(([categoria, lista]) => ({
          categoria,
          items: [...lista].sort((a, b) =>
            porNombre(a.item.producto.nombre, b.item.producto.nombre),
          ),
        })),
    };
  });

  resultado.sort((a, b) => {
    if (a.supermercado === null) return 1;
    if (b.supermercado === null) return -1;
    return porNombre(a.supermercado.nombre, b.supermercado.nombre);
  });
  return { grupos: resultado, total: aDinero(total) };
}
