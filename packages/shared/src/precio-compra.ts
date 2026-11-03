/**
 * Precio real y promedio de compra (M07 · CU-07.7, HU-44, RN-12): funciones puras que usan la API y
 * la app. El precio que el hogar paga se normaliza a la presentación del catálogo y su promedio de
 * las últimas 12 semanas respalda el costo estimado cuando no hay un precio de mercado vigente.
 */
import { redondear } from './catalogo';

/** Precio máximo que admite la columna de dinero (CU-07.7 paso 3). */
export const PRECIO_MAXIMO = 99_999.99;
/** Ventana del promedio de compra: 12 semanas hacia atrás desde la consulta (RN-12). */
export const SEMANAS_PROMEDIO_COMPRA = 12;
const MS_POR_DIA = 86_400_000;

/** Mensajes en español de CA-44.5. */
export const MENSAJES_PRECIO = {
  invalido: 'Escribe un precio válido',
  noPositivo: 'El precio debe ser mayor que Q0.00',
  decimales: 'Usa máximo 2 decimales',
  maximo: 'El precio no puede pasar de Q99,999.99',
} as const;

export type ResultadoPrecio = { ok: true; valor: number } | { ok: false; mensaje: string };

/** E1 y E2: el precio pagado debe ser mayor que 0, con 2 decimales como máximo y hasta Q99,999.99. */
export function validarPrecio(entrada: string | number | null | undefined): ResultadoPrecio {
  const texto = typeof entrada === 'number' ? String(entrada) : (entrada ?? '').trim();
  if (!/^-?\d+(\.\d+)?$/.test(texto)) return { ok: false, mensaje: MENSAJES_PRECIO.invalido };
  const n = Number(texto);
  if (n <= 0) return { ok: false, mensaje: MENSAJES_PRECIO.noPositivo };
  const decimales = (texto.split('.')[1] ?? '').replace(/0+$/, '');
  if (decimales.length > 2) return { ok: false, mensaje: MENSAJES_PRECIO.decimales };
  if (n > PRECIO_MAXIMO) return { ok: false, mensaje: MENSAJES_PRECIO.maximo };
  return { ok: true, valor: redondear(n, 2) };
}

/**
 * CU-07.7 paso 5 y 2b: precio por presentación del catálogo = precio pagado × tamaño de la
 * presentación ÷ contenido comprado (ambos en la unidad de la presentación). Ej.: Q66.25 por una
 * bolsa de 5 lb con presentación de 2 lb → 66.25 × 2 ÷ 5 = Q26.50.
 */
export function precioNormalizado(
  precioPagado: number | string,
  presentacion: number | string,
  contenidoComprado: number | string,
): number {
  return redondear((Number(precioPagado) * Number(presentacion)) / Number(contenidoComprado), 2);
}

export interface CompraConPrecio {
  /** Precio normalizado a la presentación del catálogo. */
  precioNormalizado: number | string;
  compradoEn: Date | string;
}

export interface PromedioDeCompra {
  /** Promedio en quetzales, redondeado a centavos. */
  promedio: number;
  compras: number;
}

/**
 * RN-12: promedio de los precios normalizados del hogar en las últimas 12 semanas (84 días hacia atrás
 * desde `hoy`, por la fecha en que se marcó comprado); null si no hay ninguna compra con precio.
 */
export function promedioDeCompra(
  compras: readonly CompraConPrecio[],
  hoy: Date,
): PromedioDeCompra | null {
  const desde = hoy.getTime() - SEMANAS_PROMEDIO_COMPRA * 7 * MS_POR_DIA;
  const vigentes = compras.filter((c) => new Date(c.compradoEn).getTime() >= desde);
  if (vigentes.length === 0) return null;
  const centavos = vigentes.reduce(
    (suma, c) => suma + Math.round(Number(c.precioNormalizado) * 100),
    0,
  );
  return { promedio: redondear(centavos / vigentes.length / 100, 2), compras: vigentes.length };
}
