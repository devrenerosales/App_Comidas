/** Cálculos puros del tablero de Inicio: restante, ritmo diario, ahorro y geometría de la gráfica. */
import type { SemanaTablero } from '../api/tablero';

export const aNumero = (valor: string | null): number | null => {
  if (valor === null) return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
};

/** 180.5 → "Q180.50". */
export const quetzales = (monto: number): string => `Q${monto.toFixed(2)}`;

/** "2026-11-04" → "04/11". */
export const fechaCorta = (fecha: string): string => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;

const dia = (fecha: string): number => {
  const [a, m, d] = fecha.split('-').map(Number) as [number, number, number];
  return Date.UTC(a, m - 1, d);
};

/** Días que quedan de la semana contando hoy (mínimo 1, para no dividir entre cero). */
export const diasRestantes = (hoy: string, fechaFin: string): number =>
  Math.max(1, Math.round((dia(fechaFin) - dia(hoy)) / 86_400_000) + 1);

/** Cuánto se puede gastar por día con lo que queda; 0 si ya no queda nada. */
export const ritmoDiario = (restante: number, dias: number): number =>
  restante <= 0 ? 0 : Math.round((restante / dias) * 100) / 100;

export type NivelMedidor = 'normal' | 'cerca' | 'excede';

/** El medidor cambia de estado al llegar al 85 % del presupuesto y al superarlo. */
export function nivelMedidor(gasto: number, presupuesto: number): NivelMedidor {
  if (gasto > presupuesto) return 'excede';
  return presupuesto > 0 && gasto / presupuesto >= 0.85 ? 'cerca' : 'normal';
}

export interface ResumenAhorro {
  /** Σ (presupuesto − gasto) de las semanas con ambos datos; negativo si se gastó de más. */
  ahorro: number;
  /** Semanas que entran en el cálculo. */
  semanas: number;
  /** Gasto promedio de esas semanas, o null si no hay ninguna. */
  promedio: number | null;
}

export function resumenAhorro(historial: readonly SemanaTablero[]): ResumenAhorro {
  let ahorro = 0;
  let gastado = 0;
  let semanas = 0;
  for (const s of historial) {
    const presupuesto = aNumero(s.presupuesto);
    const gasto = aNumero(s.gastoReal);
    if (presupuesto === null || gasto === null) continue;
    ahorro += presupuesto - gasto;
    gastado += gasto;
    semanas += 1;
  }
  return {
    ahorro: Math.round(ahorro * 100) / 100,
    semanas,
    promedio: semanas ? Math.round((gastado / semanas) * 100) / 100 : null,
  };
}

/** Máximo "redondo" (1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8 × 10ⁿ) que contiene al valor, para el eje. */
export function maximoRedondo(valor: number): number {
  if (valor <= 0) return 100;
  const exponente = Math.floor(Math.log10(valor));
  const base = 10 ** exponente;
  for (const paso of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (valor <= paso * base) return paso * base;
  }
  return 10 * base;
}

export interface Columna {
  id: string;
  etiqueta: string;
  gasto: number | null;
  presupuesto: number | null;
  excede: boolean;
  /** La última semana (la más reciente) lleva el color de énfasis. */
  actual: boolean;
  x: number;
  ancho: number;
  /** Arriba y alto de la columna de gasto (0 de alto si no hay gasto). */
  y: number;
  alto: number;
  /** Altura (y) de la marca del presupuesto, o null si no hay. */
  yPresupuesto: number | null;
}

export interface Grafica {
  columnas: Columna[];
  maximo: number;
  /** Líneas de la cuadrícula con su valor y su altura. */
  marcas: { valor: number; y: number }[];
}

export const MEDIDAS = { ancho: 340, alto: 220, izquierda: 40, derecha: 6, arriba: 14, abajo: 28 };

/**
 * Geometría de la gráfica de columnas: la más antigua a la izquierda, la más reciente a la
 * derecha. `historial` llega de la más reciente a la más antigua, como lo entrega la API.
 */
export function construirGrafica(historial: readonly SemanaTablero[]): Grafica {
  const semanas = [...historial].reverse();
  const valores = semanas.flatMap((s) => [aNumero(s.gastoReal), aNumero(s.presupuesto)]);
  const maximo = maximoRedondo(Math.max(0, ...valores.filter((v): v is number => v !== null)));
  const { ancho, alto, izquierda, derecha, arriba, abajo } = MEDIDAS;
  const zonaAncho = ancho - izquierda - derecha;
  const zonaAlto = alto - arriba - abajo;
  const banda = zonaAncho / Math.max(semanas.length, 1);
  const anchoColumna = Math.min(24, banda * 0.55);
  const yDe = (v: number): number => arriba + zonaAlto - (v / maximo) * zonaAlto;

  const columnas = semanas.map((s, i): Columna => {
    const gasto = aNumero(s.gastoReal);
    const presupuesto = aNumero(s.presupuesto);
    const x = izquierda + banda * i + (banda - anchoColumna) / 2;
    const y = gasto === null ? yDe(0) : yDe(gasto);
    return {
      id: s.id,
      etiqueta: fechaCorta(s.fechaInicio),
      gasto,
      presupuesto,
      excede: gasto !== null && presupuesto !== null && gasto > presupuesto,
      actual: i === semanas.length - 1,
      x,
      ancho: anchoColumna,
      y,
      alto: gasto === null ? 0 : yDe(0) - y,
      yPresupuesto: presupuesto === null ? null : yDe(presupuesto),
    };
  });

  return {
    columnas,
    maximo,
    marcas: [0, maximo / 2, maximo].map((valor) => ({ valor, y: yDe(valor) })),
  };
}

/** Columna con las dos esquinas de arriba redondeadas y la base recta (4 px). */
export function trazoColumna(x: number, y: number, ancho: number, alto: number, radio = 4): string {
  const r = Math.min(radio, ancho / 2, alto);
  if (alto <= 0) return '';
  return [
    `M${x},${y + alto}`,
    `V${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `H${x + ancho - r}`,
    `Q${x + ancho},${y} ${x + ancho},${y + r}`,
    `V${y + alto}`,
    'Z',
  ].join(' ');
}

export const NOMBRE_TIEMPO: Record<string, string> = {
  DESAYUNO: 'Desayuno',
  ALMUERZO: 'Almuerzo',
  CENA: 'Cena',
};
