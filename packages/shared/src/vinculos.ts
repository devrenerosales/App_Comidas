/**
 * Vínculo producto ↔ producto en tienda (M08 · CU-08.2, HU-35): reglas puras que usan la API
 * y la app. El factor lleva el precio de la presentación en tienda a la presentación de
 * compra del catálogo (precio normalizado = precio ÷ factor).
 */
import { convertirCantidad, redondear, type UnidadMedida } from './catalogo';

/** Presentación con su unidad completa (cantidad en texto o número). */
export interface PresentacionConUnidad {
  cantidad: number | string;
  unidad: UnidadMedida;
}

/**
 * CU-08.2 paso 4: factor = presentación de la tienda ÷ presentación de compra del catálogo,
 * con 6 decimales. Una bolsa de 5 lb contra una de 2 lb da 2.5. Devuelve `null` si las unidades
 * no se pueden convertir entre sí (E1) o alguna cantidad no es mayor que 0.
 */
export function factorVinculo(
  tienda: PresentacionConUnidad,
  catalogo: PresentacionConUnidad,
): number | null {
  const cantidadTienda = Number(tienda.cantidad);
  const cantidadCatalogo = Number(catalogo.cantidad);
  if (!(cantidadTienda > 0) || !(cantidadCatalogo > 0)) return null;
  const enUnidadCatalogo = convertirCantidad(cantidadTienda, tienda.unidad, catalogo.unidad);
  if (enUnidadCatalogo === null) return null;
  return redondear(enUnidadCatalogo / cantidadCatalogo, 6);
}

/** "libra" → "libras", "unidad" → "unidades": el plural que usa el mensaje de E1. */
export function pluralUnidad(nombre: string): string {
  return /[aeiou]$/i.test(nombre) ? `${nombre}s` : `${nombre}es`;
}

/** CA-35.4: "La unidad de la presentación no es convertible a libras". */
export function mensajeUnidadNoConvertible(nombreUnidadCatalogo: string): string {
  return `La unidad de la presentación no es convertible a ${pluralUnidad(nombreUnidadCatalogo)}`;
}

/** CU-08.2 E2: la URL debe ser http(s) y del dominio del supermercado o de un subdominio suyo. */
export function urlEnDominio(url: string, dominio: string): boolean {
  // El host es lo que queda tras "http(s)://" y un posible "usuario@", sin puerto ni ruta.
  const partes = /^https?:\/\/(?:[^/?#@]*@)?([^/?#:@]+)(?::\d+)?(?:[/?#]|$)/i.exec(url.trim());
  if (!partes) return false;
  const host = partes[1]!.toLowerCase();
  const esperado = dominio.toLowerCase().replace(/^www\./, '');
  return host === esperado || host.endsWith(`.${esperado}`);
}

/** Precio de la presentación en tienda llevado a la de compra del catálogo, a centavos (RN-08). */
export function precioDeVinculo(precio: number | string, factor: number | string): number {
  return redondear(Number(precio) / Number(factor), 2);
}
