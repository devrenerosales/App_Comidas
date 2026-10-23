/**
 * Reglas de configuración del hogar compartidas por la API y la app (M02 · CU-02.1, CU-02.2,
 * CU-02.3 · RF-05, RF-06, RF-07 · RN-01, RN-06, RN-10).
 *
 * Todo el cálculo de dinero se hace con **enteros**: los montos en centavos y los porcentajes en
 * centésimas de punto porcentual (100.00 % = 10 000). Los valores entran y salen como texto
 * decimal (`"500.00"`, `"60.00"`), igual que en la API (api-contrato §1.2); nunca se suman ni
 * multiplican números de punto flotante.
 *
 * Supuestos de M02 que se implementan aquí:
 * - La distribución se guarda en porcentaje con 2 decimales; el modo monto convierte a porcentaje.
 * - Los montos se redondean a centavos y la diferencia de redondeo va al almuerzo (o al tiempo de
 *   mayor %, si no hay almuerzo).
 * - La vista previa siempre propone la distribución por defecto de los nuevos tiempos (RN-06, D-01).
 */
import { ORDEN_TIEMPOS, TiempoComida } from './enums';
import { distribucionPorDefecto } from './presupuesto';

/** Valor decimal aceptado como entrada: texto (`"60.00"`) o número con hasta 2 decimales. */
export type Decimal = string | number;

/** Porcentaje o monto por tiempo de comida. */
export type PorTiempo<T> = Partial<Record<TiempoComida, T>>;

/** Opción de tiempos de comida de CU-02.1 (RF-05). */
export const OpcionTiempos = {
  SOLO_ALMUERZO: 'SOLO_ALMUERZO',
  DOS_TIEMPOS: 'DOS_TIEMPOS',
  TRES_TIEMPOS: 'TRES_TIEMPOS',
} as const;
export type OpcionTiempos = (typeof OpcionTiempos)[keyof typeof OpcionTiempos];

/** Modo de distribución del presupuesto (CU-02.2 paso 3). */
export const ModoDistribucion = {
  PORCENTAJE: 'PORCENTAJE',
  MONTO: 'MONTO',
} as const;
export type ModoDistribucion = (typeof ModoDistribucion)[keyof typeof ModoDistribucion];

/** Presupuesto semanal máximo aceptado (Q99,999.99; mismo tope que el gasto real). */
export const PRESUPUESTO_MAXIMO_CENTAVOS = 9_999_999;

/** 100.00 % en centésimas de punto porcentual. */
export const CIEN_POR_CIENTO = 10_000;

/** Nombres para mostrar de cada tiempo de comida. */
export const NOMBRE_TIEMPO: Readonly<Record<TiempoComida, string>> = {
  DESAYUNO: 'Desayuno',
  ALMUERZO: 'Almuerzo',
  CENA: 'Cena',
};

/** Mensajes en español de los criterios de aceptación de HU-05, HU-06 y HU-07. */
export const MENSAJES_CONFIGURACION = {
  /** CU-02.1 3a / CA-05.3. */
  seleccionaDosTiempos: 'Selecciona exactamente dos tiempos',
  /** Combinación que no es solo almuerzo, dos tiempos ni tres tiempos. */
  combinacionInvalida: 'Elige solo almuerzo, dos tiempos o los tres tiempos',
  /** CU-02.1 E1 / CA-05.4. */
  soloAdminTiempos: 'Solo el administrador puede cambiar los tiempos de comida',
  /** RN-10 para presupuesto y distribución. */
  soloAdminConfiguracion: 'Solo el administrador puede cambiar esta configuración',
  /** CU-02.2 E1. */
  presupuestoInvalido: 'Ingresa un presupuesto mayor a Q0.00',
  presupuestoMaximo: 'El presupuesto semanal admite hasta Q99999.99',
  /** CU-02.3 E1. */
  versionDesactualizada: 'La configuración cambió, revisa de nuevo',
  /** La distribución debe traer exactamente los tiempos activos. */
  distribucionIncompleta: 'Indica el reparto de cada tiempo de comida activo',
  porcentajeInvalido: 'Cada porcentaje debe estar entre 0 % y 100 % con hasta 2 decimales',
  montoInvalido: 'Cada monto debe ser de Q0.00 o más con hasta 2 decimales',
} as const;

const DECIMAL = /^(\d{1,9})(?:\.(\d{1,2}))?$/;

/**
 * Convierte un decimal con hasta 2 decimales a un entero escalado ×100 (`"12.5"` → 1250).
 * Devuelve `null` si no es un decimal no negativo válido. Un número se lee por su texto, así
 * que `0.1` se interpreta como `"0.1"` y no como su aproximación binaria.
 */
export function aEnteroX100(valor: Decimal): number | null {
  const texto = typeof valor === 'number' ? (Number.isFinite(valor) ? String(valor) : '') : valor;
  const coincide = DECIMAL.exec(texto.trim());
  if (!coincide) return null;
  const enteros = coincide[1] as string;
  const decimales = coincide[2] ?? '';
  return Number(enteros) * 100 + Number(decimales.padEnd(2, '0'));
}

/** Entero escalado ×100 a texto con 2 decimales (`1250` → `"12.50"`). */
export function deEnteroX100(valor: number): string {
  const signo = valor < 0 ? '-' : '';
  const absoluto = Math.abs(valor);
  const enteros = Math.trunc(absoluto / 100);
  const decimales = absoluto - enteros * 100;
  return `${signo}${enteros}.${String(decimales).padStart(2, '0')}`;
}

/** Monto en GTQ a centavos (`"500.00"` → 50000) o `null` si no es válido. */
export const aCentavos = aEnteroX100;

/** Centavos a texto decimal (`50000` → `"500.00"`). */
export const deCentavos = deEnteroX100;

/** Quetzales para mostrar: `"Q300"` si no hay centavos o `"Q20.50"`; `conCentavos` fuerza `Q20.00`. */
export function formatoQuetzales(centavos: number, conCentavos = false): string {
  const texto = deCentavos(centavos);
  return `Q${!conCentavos && texto.endsWith('.00') ? texto.slice(0, -3) : texto}`;
}

/** Porcentaje para mostrar sin ceros sobrantes (`500` → `"5"`, `1250` → `"12.5"`). */
export function formatoPorcentaje(centesimas: number): string {
  return deEnteroX100(centesimas).replace(/\.?0+$/, '');
}

/** División entera redondeada a la mitad hacia arriba (numerador y divisor enteros, ≥ 0). */
function dividirRedondeado(numerador: number, divisor: number): number {
  const resto = numerador % divisor;
  const cociente = (numerador - resto) / divisor;
  return resto * 2 >= divisor ? cociente + 1 : cociente;
}

/** Tiempos presentes en el objeto, en orden canónico. */
function tiemposDe<T>(valores: PorTiempo<T>): TiempoComida[] {
  return ORDEN_TIEMPOS.filter((t) => valores[t] !== undefined);
}

/**
 * Tiempo que absorbe la diferencia de redondeo: el almuerzo si está, si no el de mayor
 * porcentaje (en empate, el primero del día).
 */
export function tiempoQueAbsorbe(porcentajes: PorTiempo<number>): TiempoComida | undefined {
  const tiempos = tiemposDe(porcentajes);
  if (tiempos.includes(TiempoComida.ALMUERZO)) return TiempoComida.ALMUERZO;
  return tiempos.reduce<TiempoComida | undefined>(
    (mayor, t) =>
      mayor === undefined || (porcentajes[t] as number) > (porcentajes[mayor] as number)
        ? t
        : mayor,
    undefined,
  );
}

/** Lee porcentajes de texto o número a centésimas; lanza `RangeError` si alguno no es válido. */
export function aCentesimas(porcentajes: PorTiempo<Decimal>): PorTiempo<number> {
  const resultado: PorTiempo<number> = {};
  for (const tiempo of tiemposDe(porcentajes)) {
    const valor = aEnteroX100(porcentajes[tiempo] as Decimal);
    if (valor === null || valor > CIEN_POR_CIENTO) {
      throw new RangeError(`Porcentaje no válido para ${tiempo}: ${String(porcentajes[tiempo])}`);
    }
    resultado[tiempo] = valor;
  }
  return resultado;
}

/**
 * RN-01 — Monto de cada tiempo = presupuesto semanal × % asignado, redondeado a centavos.
 * La diferencia de redondeo se asigna al almuerzo (o al tiempo de mayor %), de modo que la suma
 * de los montos es exactamente el presupuesto cuando los porcentajes suman 100 %.
 *
 * @param presupuesto texto decimal (`"500.00"`) o número con hasta 2 decimales.
 * @param porcentajes porcentaje de cada tiempo activo (`{ ALMUERZO: "60.00", CENA: 40 }`).
 * @returns montos con 2 decimales por tiempo (`{ ALMUERZO: "300.00", CENA: "200.00" }`).
 */
export function calcularMontos(
  presupuesto: Decimal,
  porcentajes: PorTiempo<Decimal>,
): PorTiempo<string> {
  const total = aCentavos(presupuesto);
  if (total === null) throw new RangeError(`Presupuesto no válido: ${String(presupuesto)}`);
  return mapear(calcularMontosEnCentavos(total, aCentesimas(porcentajes)), deCentavos);
}

/** Igual que `calcularMontos`, con centavos y centésimas enteros. */
export function calcularMontosEnCentavos(
  totalCentavos: number,
  centesimas: PorTiempo<number>,
): PorTiempo<number> {
  const montos: PorTiempo<number> = {};
  let asignado = 0;
  let sumaPorcentajes = 0;
  for (const tiempo of tiemposDe(centesimas)) {
    const pc = centesimas[tiempo] as number;
    const monto = dividirRedondeado(totalCentavos * pc, CIEN_POR_CIENTO);
    montos[tiempo] = monto;
    asignado += monto;
    sumaPorcentajes += pc;
  }
  const absorbe = tiempoQueAbsorbe(centesimas);
  if (absorbe && sumaPorcentajes === CIEN_POR_CIENTO) {
    montos[absorbe] = (montos[absorbe] as number) + totalCentavos - asignado;
  }
  return montos;
}

/** Resultado de validar que el reparto esté completo. */
export interface ValidacionReparto {
  valido: boolean;
  /** Suma en centésimas (porcentaje) o centavos (monto). */
  suma: number;
  /** Positivo = falta; negativo = sobra o excede. */
  diferencia: number;
  /** Mensaje para el usuario o `null` si es válido. */
  mensaje: string | null;
}

/**
 * CU-02.2 6a — Los porcentajes deben sumar 100 %. Mensajes: "Faltan 5 % por asignar" o
 * "Sobran 5 %". Lanza `RangeError` si algún valor no es un porcentaje válido.
 */
export function validarSumaPorcentajes(porcentajes: PorTiempo<Decimal>): ValidacionReparto {
  const suma = Object.values(aCentesimas(porcentajes)).reduce((a, b) => a + b, 0);
  const diferencia = CIEN_POR_CIENTO - suma;
  let mensaje: string | null = null;
  if (diferencia > 0) mensaje = `Faltan ${formatoPorcentaje(diferencia)} % por asignar`;
  if (diferencia < 0) mensaje = `Sobran ${formatoPorcentaje(-diferencia)} %`;
  return { valido: diferencia === 0, suma, diferencia, mensaje };
}

/** `true` si los porcentajes suman exactamente 100 %. */
export function sumaCien(porcentajes: PorTiempo<Decimal>): boolean {
  return validarSumaPorcentajes(porcentajes).valido;
}

/**
 * CU-02.2 6b — En modo monto, los montos deben sumar el presupuesto. Mensajes:
 * "Faltan Q20.00 por asignar" o "Excede el presupuesto por Q20.00".
 */
export function validarSumaMontos(
  presupuesto: Decimal,
  montos: PorTiempo<Decimal>,
): ValidacionReparto {
  const total = aCentavos(presupuesto);
  if (total === null) throw new RangeError(`Presupuesto no válido: ${String(presupuesto)}`);
  const suma = tiemposDe(montos).reduce((acc, t) => {
    const monto = aCentavos(montos[t] as Decimal);
    if (monto === null) throw new RangeError(`Monto no válido para ${t}: ${String(montos[t])}`);
    return acc + monto;
  }, 0);
  const diferencia = total - suma;
  let mensaje: string | null = null;
  if (diferencia > 0) mensaje = `Faltan ${formatoQuetzales(diferencia, true)} por asignar`;
  if (diferencia < 0) mensaje = `Excede el presupuesto por ${formatoQuetzales(-diferencia, true)}`;
  return { valido: diferencia === 0, suma, diferencia, mensaje };
}

/**
 * CU-02.2 — Convierte montos a porcentajes con 2 decimales (modo monto → % al guardar). La
 * diferencia de redondeo va al almuerzo (o al de mayor monto) para que sumen 100.00 %.
 * Requiere que los montos sumen el presupuesto (ver `validarSumaMontos`).
 */
export function porcentajesDesdeMontos(
  presupuesto: Decimal,
  montos: PorTiempo<Decimal>,
): PorTiempo<string> {
  const validacion = validarSumaMontos(presupuesto, montos);
  if (!validacion.valido) throw new RangeError(validacion.mensaje as string);
  const total = validacion.suma;
  if (total === 0) throw new RangeError(MENSAJES_CONFIGURACION.presupuestoInvalido);
  const centavos = mapear(montos, (m) => aCentavos(m) as number);
  const porcentajes: PorTiempo<number> = {};
  let asignado = 0;
  for (const tiempo of tiemposDe(centavos)) {
    const pc = dividirRedondeado((centavos[tiempo] as number) * CIEN_POR_CIENTO, total);
    porcentajes[tiempo] = pc;
    asignado += pc;
  }
  const absorbe = tiempoQueAbsorbe(centavos) as TiempoComida;
  porcentajes[absorbe] = (porcentajes[absorbe] as number) + CIEN_POR_CIENTO - asignado;
  return mapear(porcentajes, deEnteroX100);
}

/**
 * CU-02.2 E1 — Presupuesto semanal mayor a Q0.00, con hasta 2 decimales y hasta Q99999.99.
 * Devuelve el mensaje de error o `null` si es válido.
 */
export function validarPresupuesto(valor: Decimal | null | undefined): string | null {
  const centavos = valor === null || valor === undefined ? null : aCentavos(valor);
  if (centavos === null || centavos <= 0) return MENSAJES_CONFIGURACION.presupuestoInvalido;
  if (centavos > PRESUPUESTO_MAXIMO_CENTAVOS) return MENSAJES_CONFIGURACION.presupuestoMaximo;
  return null;
}

/** Tiempos en orden canónico y sin duplicados. */
export function normalizarTiempos(tiempos: readonly TiempoComida[]): TiempoComida[] {
  return ORDEN_TIEMPOS.filter((t) => tiempos.includes(t));
}

/** `true` si la combinación es solo almuerzo, dos tiempos cualesquiera o los tres (RF-05). */
export function esCombinacionValida(tiempos: readonly TiempoComida[]): boolean {
  try {
    distribucionPorDefecto(tiempos);
    return normalizarTiempos(tiempos).length === tiempos.length;
  } catch {
    return false;
  }
}

/** Opción de CU-02.1 que corresponde a los tiempos activos (o `null` si no es válida). */
export function opcionDeTiempos(tiempos: readonly TiempoComida[]): OpcionTiempos | null {
  if (!esCombinacionValida(tiempos)) return null;
  if (tiempos.length === 1) return OpcionTiempos.SOLO_ALMUERZO;
  return tiempos.length === 2 ? OpcionTiempos.DOS_TIEMPOS : OpcionTiempos.TRES_TIEMPOS;
}

/** Resultado de elegir una opción de tiempos en la pantalla. */
export type SeleccionTiempos =
  | { valido: true; tiempos: TiempoComida[] }
  | { valido: false; mensaje: string };

/**
 * CU-02.1 pasos 2–3 — Tiempos activos según la opción elegida. Con "dos tiempos" se usan los
 * marcados y deben ser exactamente dos ("Selecciona exactamente dos tiempos", CA-05.3).
 */
export function tiemposDeOpcion(
  opcion: OpcionTiempos,
  marcados: readonly TiempoComida[] = [],
): SeleccionTiempos {
  if (opcion === OpcionTiempos.SOLO_ALMUERZO) {
    return { valido: true, tiempos: [TiempoComida.ALMUERZO] };
  }
  if (opcion === OpcionTiempos.TRES_TIEMPOS) {
    return { valido: true, tiempos: [...ORDEN_TIEMPOS] };
  }
  const tiempos = normalizarTiempos(marcados);
  if (tiempos.length !== 2) {
    return { valido: false, mensaje: MENSAJES_CONFIGURACION.seleccionaDosTiempos };
  }
  return { valido: true, tiempos };
}

/** Un tiempo de la configuración tal como lo expone la API. */
export interface TiempoDeConfiguracion {
  tiempo: TiempoComida;
  activo: boolean;
  porcentaje: Decimal;
}

/** Configuración vigente que necesita la vista previa. */
export interface ConfiguracionParaVistaPrevia {
  presupuestoSemanal: Decimal;
  tiempos: readonly TiempoDeConfiguracion[];
}

/** Porcentaje y monto de un tiempo (texto con 2 decimales). */
export interface RepartoTiempo {
  tiempo: TiempoComida;
  porcentaje: string;
  monto: string;
}

/** Qué le pasa a un tiempo al confirmar la vista previa. */
export const CambioTiempo = {
  AGREGADO: 'AGREGADO',
  QUITADO: 'QUITADO',
  MODIFICADO: 'MODIFICADO',
  SIN_CAMBIO: 'SIN_CAMBIO',
} as const;
export type CambioTiempo = (typeof CambioTiempo)[keyof typeof CambioTiempo];

/** Fila de la tabla "Actual → Nuevo" de la vista previa (CA-07.1). */
export interface ImpactoTiempo {
  tiempo: TiempoComida;
  cambio: CambioTiempo;
  actual: { porcentaje: string; monto: string } | null;
  nuevo: { porcentaje: string; monto: string } | null;
  /** Nuevo − actual en centavos, como texto con signo (`"-60.00"`). */
  diferenciaMonto: string;
}

export interface VistaPrevia {
  presupuestoSemanal: string;
  actual: RepartoTiempo[];
  nuevo: RepartoTiempo[];
  impacto: ImpactoTiempo[];
  /** `false` si los porcentajes propuestos no suman 100 % (no se puede confirmar). */
  valida: boolean;
  /** "Faltan 5 % por asignar" / "Sobran 5 %" o `null`. */
  mensaje: string | null;
}

/** Reparto (porcentajes y montos) de los tiempos activos de una configuración. */
export function repartoDe(presupuesto: Decimal, porcentajes: PorTiempo<Decimal>): RepartoTiempo[] {
  const centesimas = aCentesimas(porcentajes);
  const total = aCentavos(presupuesto);
  if (total === null) throw new RangeError(`Presupuesto no válido: ${String(presupuesto)}`);
  const montos = calcularMontosEnCentavos(total, centesimas);
  return tiemposDe(centesimas).map((tiempo) => ({
    tiempo,
    porcentaje: deEnteroX100(centesimas[tiempo] as number),
    monto: deCentavos(montos[tiempo] as number),
  }));
}

/** Porcentajes de los tiempos activos de una configuración. */
export function porcentajesActivos(tiempos: readonly TiempoDeConfiguracion[]): PorTiempo<Decimal> {
  const resultado: PorTiempo<Decimal> = {};
  for (const t of tiempos) if (t.activo) resultado[t.tiempo] = t.porcentaje;
  return resultado;
}

/**
 * CU-02.3 — Vista previa (sin guardar) del cambio de tiempos de comida: reparto actual, reparto
 * nuevo e impacto por tiempo. Propone siempre la distribución por defecto de los nuevos tiempos
 * (RN-06, D-01) sobre el presupuesto vigente o el indicado; `ajuste` permite al administrador
 * cambiar los porcentajes propuestos (CU-02.3 paso 4) y, si no suman 100 %, la vista previa
 * queda no válida con el mensaje de faltante o sobrante (CA-07.5).
 *
 * Lanza `RangeError` si la combinación de tiempos no es válida o si el ajuste no corresponde a
 * los nuevos tiempos.
 */
export function vistaPrevia(
  configActual: ConfiguracionParaVistaPrevia,
  nuevosTiempos: readonly TiempoComida[],
  presupuesto: Decimal = configActual.presupuestoSemanal,
  ajuste?: PorTiempo<Decimal>,
): VistaPrevia {
  if (!esCombinacionValida(nuevosTiempos)) {
    throw new RangeError(MENSAJES_CONFIGURACION.combinacionInvalida);
  }
  const tiempos = normalizarTiempos(nuevosTiempos);
  const propuestos: PorTiempo<Decimal> = ajuste ?? distribucionPorDefecto(tiempos);
  const tiemposAjuste = tiemposDe(propuestos);
  if (tiemposAjuste.join('+') !== tiempos.join('+')) {
    throw new RangeError(MENSAJES_CONFIGURACION.distribucionIncompleta);
  }
  const validacion = validarSumaPorcentajes(propuestos);
  const actual = repartoDe(
    configActual.presupuestoSemanal,
    porcentajesActivos(configActual.tiempos),
  );
  // `repartoDe` valida el presupuesto: si llega aquí, `aCentavos` no es null.
  const nuevo = repartoDe(presupuesto, propuestos);
  const montoTexto = deCentavos(aCentavos(presupuesto) as number);
  const buscar = (lista: RepartoTiempo[], t: TiempoComida) => lista.find((r) => r.tiempo === t);

  const impacto = ORDEN_TIEMPOS.flatMap<ImpactoTiempo>((tiempo) => {
    const antes = buscar(actual, tiempo);
    const despues = buscar(nuevo, tiempo);
    if (!antes && !despues) return [];
    let cambio: CambioTiempo = CambioTiempo.SIN_CAMBIO;
    if (!antes) cambio = CambioTiempo.AGREGADO;
    else if (!despues) cambio = CambioTiempo.QUITADO;
    else if (antes.porcentaje !== despues.porcentaje || antes.monto !== despues.monto) {
      cambio = CambioTiempo.MODIFICADO;
    }
    const centavos = (r?: RepartoTiempo) => (r ? (aCentavos(r.monto) as number) : 0);
    return [
      {
        tiempo,
        cambio,
        actual: antes ? { porcentaje: antes.porcentaje, monto: antes.monto } : null,
        nuevo: despues ? { porcentaje: despues.porcentaje, monto: despues.monto } : null,
        diferenciaMonto: deCentavos(centavos(despues) - centavos(antes)),
      },
    ];
  });

  return {
    presupuestoSemanal: montoTexto,
    actual,
    nuevo,
    impacto,
    valida: validacion.valido,
    mensaje: validacion.mensaje,
  };
}

function mapear<A, B>(valores: PorTiempo<A>, fn: (valor: A) => B): PorTiempo<B> {
  const resultado: PorTiempo<B> = {};
  for (const tiempo of tiemposDe(valores)) resultado[tiempo] = fn(valores[tiempo] as A);
  return resultado;
}
