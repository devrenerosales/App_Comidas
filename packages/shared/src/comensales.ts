/**
 * Reglas de comensales compartidas por la API y la app (M01 · CU-01.3 · RF-03 · HU-03).
 * D-02: cada comensal tiene un factor de porción sugerido en 1.0 y editable de 0.25 a 2.0 en
 * pasos de 0.25; las cantidades escalan con la suma de factores de los comensales activos
 * (RN-07). La etiqueta adulto / niño es solo informativa y no cambia el cálculo.
 */

/** Etiqueta informativa del comensal (enum `tipo_comensal`). */
export const TipoComensal = {
  ADULTO: 'ADULTO',
  NINO: 'NINO',
} as const;
export type TipoComensal = (typeof TipoComensal)[keyof typeof TipoComensal];

/** Largo máximo del nombre del comensal (columna `comensal.nombre`). */
export const LARGO_MAXIMO_NOMBRE_COMENSAL = 60;

/** Factor de porción (D-02). */
export const FACTOR_PORCION_MINIMO = 0.25;
export const FACTOR_PORCION_MAXIMO = 2;
export const PASO_FACTOR_PORCION = 0.25;
export const FACTOR_PORCION_SUGERIDO = 1;

/** Mensajes en español de los criterios de aceptación de HU-03. */
export const MENSAJES_COMENSALES = {
  /** CU-01.3 E1 / CA-03.3. */
  nombreRepetido: 'Ya existe un comensal con ese nombre',
  /** CU-01.3 E1. */
  nombreObligatorio: 'Ingresa el nombre del comensal',
  nombreLargo: `El nombre del comensal admite hasta ${LARGO_MAXIMO_NOMBRE_COMENSAL} caracteres`,
  /** CU-01.3 E3 / CA-03.6. */
  factorInvalido: 'El factor debe estar entre 0.25 y 2.0 en pasos de 0.25',
  /** CU-01.3 E2. */
  ultimoComensal: 'Debe quedar al menos un comensal activo en el hogar',
  /** CA-03.4 / RN-10. */
  soloAdministrador: 'Solo el administrador puede modificar comensales',
  tipoInvalido: 'Elige adulto o niño',
  noEncontrado: 'El comensal no existe',
} as const;

/** Nombre limpio para mostrar y guardar: sin espacios alrededor ni repetidos. */
export function limpiarNombreComensal(nombre: string): string {
  return nombre.trim().replace(/\s+/g, ' ');
}

/**
 * Clave para detectar nombres repetidos en el hogar (`comensal.nombre_normalizado`): limpio,
 * en minúsculas y sin tildes, así "Sofía" y "sofia " son el mismo comensal.
 */
export function normalizarNombreComensal(nombre: string): string {
  return limpiarNombreComensal(nombre).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

const DECIMAL = /^\d+(\.\d+)?$/;

/** Convierte el factor recibido (número o texto decimal como `"0.50"`) a número, o `null`. */
export function leerFactorPorcion(valor: unknown): number | null {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  if (typeof valor === 'string' && DECIMAL.test(valor.trim())) return Number(valor.trim());
  return null;
}

/** `true` si el factor está entre 0.25 y 2.0 y es múltiplo de 0.25 (D-02, CU-01.3 E3). */
export function esFactorPorcionValido(valor: unknown): boolean {
  const factor = leerFactorPorcion(valor);
  if (factor === null) return false;
  if (factor < FACTOR_PORCION_MINIMO || factor > FACTOR_PORCION_MAXIMO) return false;
  return Number.isInteger(factor / PASO_FACTOR_PORCION);
}

/** Factor como texto decimal de 2 decimales (`decimal(3,2)`, api-contrato §1.2): `0.5` → `"0.50"`. */
export function formatearFactor(factor: number | string): string {
  return Number(factor).toFixed(2);
}

/** Factor para mostrar: `1` → `"1.0"`, `0.25` → `"0.25"`, `"1.50"` → `"1.5"`. */
export function mostrarFactor(factor: number | string): string {
  const n = Number(factor);
  return Number.isInteger(n) ? n.toFixed(1) : String(n);
}

/** Suma o resta un paso de 0.25 sin salir del rango 0.25–2.0 (stepper de la app). */
export function pasoFactor(factor: number | string, direccion: 1 | -1): number {
  const siguiente = Number(factor) + direccion * PASO_FACTOR_PORCION;
  return Math.min(FACTOR_PORCION_MAXIMO, Math.max(FACTOR_PORCION_MINIMO, siguiente));
}

/** Lo mínimo de un comensal que necesita el cálculo de porciones. */
export interface ComensalConFactor {
  factorPorcion: number | string;
  /** Si se omite cuenta como activo. */
  activo?: boolean;
}

/**
 * Total de porciones del hogar = Σ factores de los comensales **activos** (RN-07, D-02). Lo usan
 * HU-03 (pantalla y respuestas de la API), HU-12 (escalado de ingredientes) y HU-28 (lista de
 * compras). La etiqueta adulto / niño no interviene. Se suma en cuartos enteros para no
 * arrastrar error de punto flotante.
 */
export function totalPorciones(comensales: readonly ComensalConFactor[]): number {
  const cuartos = comensales
    .filter((c) => c.activo !== false)
    .reduce((suma, c) => suma + Math.round(Number(c.factorPorcion) * 4), 0);
  return cuartos / 4;
}
