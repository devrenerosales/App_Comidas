/**
 * Lista de compras en el dispositivo (CU-07.3, HU-30): la última lista recibida del servidor más la
 * cola de cambios que todavía no se envían. Lo que se ve es la lista con la cola aplicada encima, así
 * que sigue funcionando sin conexión y el contador de pendientes sale de la cola.
 */
import { deCentavos, resolverCambio, type CambioLista } from '@menu/shared';
import type { ItemLista, ListaCompras } from '../api/listas';

export interface EstadoLocal {
  /** La última lista que devolvió el servidor. */
  base: ListaCompras;
  /** Cambios hechos en este dispositivo y aún no confirmados por el servidor, en orden. */
  cola: CambioLista[];
}

const contar = (items: ItemLista[]) => ({
  total: items.length,
  comprados: items.filter((i) => i.estado !== 'PENDIENTE').length,
  // CU-07.7 paso 7: la suma de los precios reales de lo comprado se recalcula con cada cambio.
  gastoSugerido: deCentavos(
    items
      .filter((i) => i.estado === 'COMPRADO' && i.precioReal)
      .reduce((suma, i) => suma + Math.round(Number(i.precioReal) * 100), 0),
  ),
});

/**
 * Aplica un cambio sobre la lista con las mismas reglas que el servidor (`resolverCambio`). Un cambio
 * hecho ahora en este dispositivo siempre es el más reciente, por eso el ítem actual se evalúa con
 * hora 0. Si el cambio no aplica (producto repetido, ítem que no existe) la lista queda igual.
 */
export function aplicarCambioLocal(lista: ListaCompras, cambio: CambioLista): ListaCompras {
  const actual = lista.items.find((i) => i.id === cambio.itemId);
  const resultado = resolverCambio(
    actual
      ? {
          estado: actual.estado,
          cantidadComprar: Number(actual.cantidadComprar),
          eliminado: false,
          modificadoEn: 0,
        }
      : undefined,
    cambio,
  );
  if (resultado.resultado !== 'APLICADO') return lista;
  const { parche } = resultado;

  let items: ItemLista[];
  if (parche.eliminado) {
    items = lista.items.filter((i) => i.id !== cambio.itemId);
  } else if (!actual) {
    items = [
      ...lista.items,
      {
        id: cambio.itemId,
        producto: { id: parche.productoId ?? null, nombre: parche.textoLibre ?? '' },
        cantidadRequerida: null,
        equivalente: null,
        cantidadComprar: String(parche.cantidadComprar),
        presentacion: null,
        origen: 'MANUAL',
        estado: 'PENDIENTE',
        sinConversion: false,
        comidas: [],
      },
    ];
  } else {
    items = lista.items.map((i) =>
      i.id === cambio.itemId
        ? {
            ...i,
            ...(parche.estado ? { estado: parche.estado } : {}),
            ...(parche.cantidadComprar !== undefined
              ? { cantidadComprar: String(parche.cantidadComprar) }
              : {}),
            // El precio solo existe en un ítem comprado: al pasar a otro estado se descarta (E4).
            ...(parche.estado && parche.estado !== 'COMPRADO'
              ? { precioReal: null, contenidoComprado: null, precioNormalizado: null }
              : {}),
            ...(parche.precioReal !== undefined
              ? {
                  precioReal: parche.precioReal === null ? null : parche.precioReal.toFixed(2),
                  contenidoComprado:
                    parche.contenidoComprado == null ? null : String(parche.contenidoComprado),
                  // El promedio y el precio normalizado los calcula el servidor.
                  precioNormalizado: null,
                }
              : {}),
          }
        : i,
    );
  }
  return { ...lista, items, ...contar(items) };
}

/** La lista tal como la ve el usuario: la del servidor con los cambios pendientes encima. */
export const listaVisible = ({ base, cola }: EstadoLocal): ListaCompras =>
  cola.reduce(aplicarCambioLocal, base);

const clave = (listaId: string) => `mf.lista.${listaId}`;

/** Copia local de la lista (también se usa sin conexión); null si no hay o el almacén falla. */
export function leerLocal(listaId: string): EstadoLocal | null {
  try {
    const texto = localStorage.getItem(clave(listaId));
    if (!texto) return null;
    const dato = JSON.parse(texto) as Partial<EstadoLocal>;
    return dato.base && Array.isArray(dato.cola) ? { base: dato.base, cola: dato.cola } : null;
  } catch {
    return null;
  }
}

export function guardarLocal(listaId: string, estado: EstadoLocal): void {
  try {
    localStorage.setItem(clave(listaId), JSON.stringify(estado));
  } catch {
    // Sin almacenamiento la lista sigue funcionando mientras la página esté abierta.
  }
}
