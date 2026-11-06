/** Pesos del puntaje del motor; cada uno entre 0 y 1 y la suma es 1.00 (RN-10, HU-20). */
export interface PesosMotor {
  preferencia: number;
  novedad: number;
  ahorro: number;
  afinidad: number;
}

/** Pesos por defecto del hogar (D-17). */
export const PESOS_MOTOR_POR_DEFECTO: Readonly<PesosMotor> = {
  preferencia: 0.4,
  novedad: 0.25,
  ahorro: 0.2,
  afinidad: 0.15,
};

/** RN-04: un platillo preparado hace menos de estas semanas no cuenta como novedad. */
export const SEMANAS_SIN_NOVEDAD = 2;
/** Novedad máxima a partir de esta cantidad de semanas desde la última preparación. */
export const SEMANAS_NOVEDAD_COMPLETA = 8;
/** Ventana del historial para medir la afinidad. */
export const SEMANAS_AFINIDAD = 16;
/** D-18: ahorro de un platillo con costo incompleto. */
export const AHORRO_COSTO_INCOMPLETO = 0.5;

const MS_DIA = 86_400_000;
const TOLERANCIA_SUMA = 0.001;

export interface ResultadoPesos {
  valido: boolean;
  suma: number;
  /** Texto para el administrador cuando no es válido. */
  mensaje?: string;
}

const redondear = (valor: number, decimales: number) => {
  const f = 10 ** decimales;
  return Math.round((valor + Number.EPSILON) * f) / f;
};

const entre0y1 = (valor: number) => Math.min(1, Math.max(0, valor));

/** Valida los pesos: cada uno entre 0.00 y 1.00 y suma 1.00 con tolerancia de ±0.001. */
export function validarPesosMotor(pesos: PesosMotor): ResultadoPesos {
  const valores = [pesos.preferencia, pesos.novedad, pesos.ahorro, pesos.afinidad];
  const suma = redondear(
    valores.reduce((a, v) => a + v, 0),
    2,
  );
  if (valores.some((v) => !Number.isFinite(v) || v < 0 || v > 1)) {
    return { valido: false, suma, mensaje: 'Cada peso debe estar entre 0.00 y 1.00' };
  }
  if (Math.abs(valores.reduce((a, v) => a + v, 0) - 1) > TOLERANCIA_SUMA) {
    return {
      valido: false,
      suma,
      mensaje: `Los pesos deben sumar 1.00 (suma actual ${suma.toFixed(2)})`,
    };
  }
  return { valido: true, suma };
}

const aFechaUtc = (iso: string) => {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(a!, m! - 1, d!);
};

const aIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Días completos entre dos fechas ISO (YYYY-MM-DD), con signo. */
export const diasEntre = (desde: string, hasta: string) =>
  Math.floor((aFechaUtc(hasta) - aFechaUtc(desde)) / MS_DIA);

/**
 * D-19: fecha desde la que se miden Novedad y Afinidad.
 *
 * Normalmente es el domingo de la semana planificada. Si el historial termina hace más de
 * `SEMANAS_AFINIDAD` semanas, todos los platillos tendrían Afinidad 0 y Novedad completa, así que se
 * mide desde el domingo de la semana siguiente a la última semana con historial. Sin historial
 * devuelve la semana planificada.
 */
export function fechaReferenciaMotor(
  semanaInicio: string,
  ultimaFechaHistorial: string | null,
): string {
  if (!ultimaFechaHistorial) return semanaInicio;
  if (diasEntre(ultimaFechaHistorial, semanaInicio) <= SEMANAS_AFINIDAD * 7) return semanaInicio;
  const ultima = aFechaUtc(ultimaFechaHistorial);
  const diaSemana = new Date(ultima).getUTCDay(); // 0 = domingo
  return aIso(ultima + (7 - diaSemana) * MS_DIA);
}

/** Datos de un platillo candidato para puntuarlo. */
export interface DatosPuntaje {
  esFavorito: boolean;
  /** Promedio de calificaciones de 1 a 5; null si no tiene. */
  promedioCalificaciones: number | null;
  /** Última fecha (YYYY-MM-DD) en que se preparó; null si nunca. */
  ultimaPreparacion: string | null;
  /** Costo estimado por comida; null si el costo está incompleto (D-18). */
  costo: number | null;
  /** Veces preparado en las últimas 16 semanas antes de la referencia. */
  vecesEnVentana: number;
}

/** Contexto común a todos los candidatos de un tiempo de comida. */
export interface ContextoPuntaje {
  /** Fecha de referencia (ver `fechaReferenciaMotor`). */
  referencia: string;
  /** Presupuesto del tiempo / 7. */
  presupuestoPorComida: number;
  /** Máximo de veces en la ventana de cualquier platillo del mismo tiempo. */
  maximoVeces: number;
}

export interface FactoresPuntaje {
  preferencia: number;
  novedad: number;
  ahorro: number;
  afinidad: number;
}

export interface ResultadoPuntaje {
  factores: FactoresPuntaje;
  /** Redondeado a 4 decimales. */
  puntaje: number;
}

export function factorPreferencia(d: Pick<DatosPuntaje, 'esFavorito' | 'promedioCalificaciones'>) {
  if (d.esFavorito) return 1;
  if (d.promedioCalificaciones === null) return 0.5;
  return entre0y1((d.promedioCalificaciones - 1) / 4);
}

export function factorNovedad(ultimaPreparacion: string | null, referencia: string) {
  if (!ultimaPreparacion) return 1;
  const semanas = Math.floor(diasEntre(ultimaPreparacion, referencia) / 7);
  if (semanas < SEMANAS_SIN_NOVEDAD) return 0;
  return Math.min(semanas, SEMANAS_NOVEDAD_COMPLETA) / SEMANAS_NOVEDAD_COMPLETA;
}

export function factorAhorro(costo: number | null, presupuestoPorComida: number) {
  if (costo === null) return AHORRO_COSTO_INCOMPLETO;
  if (presupuestoPorComida <= 0) return 0;
  return Math.max(0, 1 - costo / presupuestoPorComida);
}

export function factorAfinidad(vecesEnVentana: number, maximoVeces: number) {
  if (maximoVeces <= 0) return 0;
  return entre0y1(vecesEnVentana / maximoVeces);
}

/** CU-05.2: cuatro factores entre 0 y 1 y su suma ponderada con 4 decimales. */
export function calcularPuntaje(
  datos: DatosPuntaje,
  contexto: ContextoPuntaje,
  pesos: PesosMotor = PESOS_MOTOR_POR_DEFECTO,
): ResultadoPuntaje {
  const exactos: FactoresPuntaje = {
    preferencia: factorPreferencia(datos),
    novedad: factorNovedad(datos.ultimaPreparacion, contexto.referencia),
    ahorro: factorAhorro(datos.costo, contexto.presupuestoPorComida),
    afinidad: factorAfinidad(datos.vecesEnVentana, contexto.maximoVeces),
  };
  const puntaje =
    pesos.preferencia * exactos.preferencia +
    pesos.novedad * exactos.novedad +
    pesos.ahorro * exactos.ahorro +
    pesos.afinidad * exactos.afinidad;
  return {
    factores: {
      preferencia: redondear(exactos.preferencia, 4),
      novedad: redondear(exactos.novedad, 4),
      ahorro: redondear(exactos.ahorro, 4),
      afinidad: redondear(exactos.afinidad, 4),
    },
    puntaje: redondear(puntaje, 4),
  };
}

export interface CandidatoPuntuado {
  nombre: string;
  costo: number | null;
  puntaje: number;
}

/**
 * Orden de mayor a menor puntaje. Empate: menor costo (el costo incompleto va al final) y luego
 * orden alfabético (CU-05.1, flujo alterno 5a).
 */
export function ordenarPorPuntaje<T extends CandidatoPuntuado>(candidatos: readonly T[]): T[] {
  return [...candidatos].sort(
    (a, b) =>
      b.puntaje - a.puntaje ||
      (a.costo ?? Infinity) - (b.costo ?? Infinity) ||
      a.nombre.localeCompare(b.nombre, 'es'),
  );
}
