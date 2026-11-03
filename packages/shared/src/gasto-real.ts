/**
 * Gasto real de la semana (M06 · CU-06.4, HU-27): funciones puras que usan la API y la app para
 * validar el monto y compararlo con el costo estimado y con el presupuesto.
 */
import { redondear } from './catalogo';
import { aCentavos, deCentavos } from './configuracion';

/** Monto máximo que admite la columna de dinero (supuesto de CU-06.4). */
export const GASTO_MAXIMO = 99_999.99;
/** Largo máximo de la nota opcional. */
export const NOTA_GASTO_MAXIMA = 200;

/** Mensajes en español de CA-27.3. */
export const MENSAJES_GASTO = {
  invalido: 'Escribe un monto válido',
  noPositivo: 'El monto debe ser mayor que Q0.00',
  decimales: 'El monto admite como máximo 2 decimales',
  maximo: 'El monto no puede pasar de Q99,999.99',
} as const;

export type ResultadoGasto = { ok: true; valor: number } | { ok: false; mensaje: string };

/** E1: el monto debe ser mayor que 0, con 2 decimales como máximo y hasta Q99,999.99. */
export function validarGasto(entrada: string | number | null | undefined): ResultadoGasto {
  const texto =
    typeof entrada === 'number'
      ? String(entrada)
      : typeof entrada === 'string'
        ? entrada.trim()
        : '';
  if (!/^-?\d+(\.\d+)?$/.test(texto)) return { ok: false, mensaje: MENSAJES_GASTO.invalido };
  const n = Number(texto);
  if (n <= 0) return { ok: false, mensaje: MENSAJES_GASTO.noPositivo };
  const decimales = (texto.split('.')[1] ?? '').replace(/0+$/, '');
  if (decimales.length > 2) return { ok: false, mensaje: MENSAJES_GASTO.decimales };
  if (n > GASTO_MAXIMO) return { ok: false, mensaje: MENSAJES_GASTO.maximo };
  return { ok: true, valor: redondear(n, 2) };
}

/** Gasto frente a una referencia: la diferencia es gasto − referencia (positiva = se gastó más). */
export interface Diferencia {
  /** Texto decimal con signo, p. ej. `"9.25"` o `"-6.25"`. */
  monto: string;
  /** Frase lista para mostrar, p. ej. "Q9.25 más que lo estimado". */
  texto: string;
}

export interface ComparacionGasto {
  /** `null` si el menú no tiene costo estimado. */
  frenteAlEstimado: Diferencia | null;
  /** `null` si el hogar no tiene presupuesto semanal. */
  frenteAlPresupuesto: Diferencia | null;
}

const quetzales = (centavos: number): string => `Q${deCentavos(Math.abs(centavos))}`;

function diferencia(
  gasto: number,
  referencia: string | null,
  mas: string,
  menos: string,
  igual: string,
): Diferencia | null {
  const base = referencia === null ? null : aCentavos(referencia);
  if (base === null) return null;
  const d = gasto - base;
  return {
    monto: deCentavos(d),
    texto: d === 0 ? igual : `${quetzales(d)} ${d > 0 ? mas : menos}`,
  };
}

/** CA-27.1: "Q9.25 más que lo estimado" y "Q6.25 por debajo del presupuesto". */
export function compararGasto(
  gastoReal: string,
  costoEstimado: string | null,
  presupuestoSemanal: string | null,
): ComparacionGasto {
  const gasto = aCentavos(gastoReal) as number;
  return {
    frenteAlEstimado: diferencia(
      gasto,
      costoEstimado,
      'más que lo estimado',
      'menos que lo estimado',
      'Igual a lo estimado',
    ),
    frenteAlPresupuesto: diferencia(
      gasto,
      presupuestoSemanal,
      'por encima del presupuesto',
      'por debajo del presupuesto',
      'Justo en el presupuesto',
    ),
  };
}
