/**
 * Validación del precio y de la fecha de compra al registrar un precio a mano (M08 · CU-08.1,
 * HU-34): reglas puras que usan la API y la app, para que ambas digan lo mismo.
 */

/** Tope de la columna `numeric(10,2)`. */
export const PRECIO_MERCADO_MAXIMO = 99_999_999.99;

export const MENSAJE_PRECIO_NO_NUMERO = 'Ingresa un precio válido (usa punto para los decimales)';
export const MENSAJE_PRECIO_NO_POSITIVO = 'El precio debe ser mayor que 0';
export const MENSAJE_PRECIO_DECIMALES = 'El precio admite como máximo 2 decimales';
export const MENSAJE_PRECIO_MUY_ALTO = 'El precio es demasiado alto';
export const MENSAJE_FECHA_INVALIDA = 'Ingresa una fecha válida';
export const MENSAJE_FECHA_FUTURA = 'La fecha de compra no puede ser futura';

export type CodigoPrecioInvalido = 'PRECIO_INVALIDO';
export type CodigoFechaInvalida = 'FECHA_INVALIDA' | 'FECHA_FUTURA';

export type ResultadoPrecioMercado =
  | { ok: true; /** Precio con dos decimales, p. ej. "20.75". */ precio: string }
  | { ok: false; codigo: CodigoPrecioInvalido; mensaje: string };

export type ResultadoFecha =
  | { ok: true; fecha: string }
  | { ok: false; codigo: CodigoFechaInvalida; mensaje: string };

const rechazoPrecio = (mensaje: string): ResultadoPrecioMercado => ({
  ok: false,
  codigo: 'PRECIO_INVALIDO',
  mensaje,
});

/**
 * E1 (CA-34.4): el precio debe ser un número mayor que 0 con a lo sumo 2 decimales. Acepta
 * texto o número, con coma o punto decimal, y lo devuelve con dos decimales exactos.
 */
export function validarPrecioMercado(
  valor: string | number | null | undefined,
): ResultadoPrecioMercado {
  if (valor === null || valor === undefined) return rechazoPrecio(MENSAJE_PRECIO_NO_NUMERO);
  const texto = String(valor).trim().replace(',', '.');
  if (/^-\s*\d/.test(texto)) return rechazoPrecio(MENSAJE_PRECIO_NO_POSITIVO);
  const partes = /^(\d{1,12})(?:\.(\d*))?$/.exec(texto);
  if (!partes) return rechazoPrecio(MENSAJE_PRECIO_NO_NUMERO);
  const decimales = partes[2] ?? '';
  if (decimales.length > 2) return rechazoPrecio(MENSAJE_PRECIO_DECIMALES);
  const centavos = Number(partes[1]) * 100 + Number(decimales.padEnd(2, '0'));
  if (centavos <= 0) return rechazoPrecio(MENSAJE_PRECIO_NO_POSITIVO);
  if (centavos > Math.round(PRECIO_MERCADO_MAXIMO * 100))
    return rechazoPrecio(MENSAJE_PRECIO_MUY_ALTO);
  return {
    ok: true,
    precio: `${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, '0')}`,
  };
}

/** "2026-10-24" es una fecha real del calendario (no "2026-02-30"). */
function esFechaReal(fecha: string): boolean {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!partes) return false;
  const [anio, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  const fechaJs = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fechaJs.getUTCFullYear() === anio &&
    fechaJs.getUTCMonth() === mes - 1 &&
    fechaJs.getUTCDate() === dia
  );
}

/**
 * E2 (CA-34.4): la fecha de compra es una fecha real, de hoy o anterior. `hoy` es la fecha de
 * calendario de la zona de negocio ("aaaa-mm-dd"), que pone quien llama.
 */
export function validarFechaCompra(fecha: string | null | undefined, hoy: string): ResultadoFecha {
  const texto = (fecha ?? '').trim();
  if (!esFechaReal(texto)) {
    return { ok: false, codigo: 'FECHA_INVALIDA', mensaje: MENSAJE_FECHA_INVALIDA };
  }
  if (texto > hoy) return { ok: false, codigo: 'FECHA_FUTURA', mensaje: MENSAJE_FECHA_FUTURA };
  return { ok: true, fecha: texto };
}
