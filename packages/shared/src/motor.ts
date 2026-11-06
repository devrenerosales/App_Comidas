/**
 * Asignación del menú semanal (M05 · CU-05.1, HU-19): funciones puras, sin acceso a datos.
 * Recibe los candidatos ya puntuados (CU-05.2) y reparte un platillo por día y tiempo de comida
 * respetando RN-02 (misma proteína en días consecutivos del mismo tiempo), RN-03 (sin repetir
 * platillo en la semana y tiempo), los platillos fijados y el desempate de CU-05.1 5a.
 */
import type { ProteinaPrincipal } from './catalogo';
import type { TiempoComida } from './enums';
import { diaSiguiente } from './plan';
import { ordenarPorPuntaje, type FactoresPuntaje } from './puntaje';

/** Platillos que se deben reponer para cada tiempo activo (CU-05.1 precondición, CA-19.3). */
export const MINIMO_PLATILLOS_POR_TIEMPO = 10;

/** Platillo puntuado y listo para asignarse a un espacio. */
export interface CandidatoMotor {
  id: string;
  nombre: string;
  proteina: ProteinaPrincipal;
  puntaje: number;
  factores: FactoresPuntaje;
  /** Costo estimado de la comida; null si es incompleto (D-18). */
  costo: number | null;
}

/** Espacio que el usuario fijó (RF-24): se conserva tal cual al regenerar. */
export interface FijadoMotor {
  fecha: string;
  tiempo: TiempoComida;
  candidato: CandidatoMotor;
}

export interface EntradaMotor {
  /** Los siete días de la semana en orden. */
  fechas: readonly string[];
  /** Tiempos activos del hogar. */
  tiempos: readonly TiempoComida[];
  /** Candidatos aplicables a cada tiempo, sin los platillos con ingredientes excluidos. */
  candidatos: Readonly<Partial<Record<TiempoComida, readonly CandidatoMotor[]>>>;
  fijados?: readonly FijadoMotor[];
}

export interface AsignacionMotor {
  fecha: string;
  tiempo: TiempoComida;
  /** null = "Sin sugerencia" (CU-05.1 E3). */
  candidato: CandidatoMotor | null;
  fijado: boolean;
}

export interface AvisoSinSugerencia {
  codigo: 'SIN_SUGERENCIA';
  fecha: string;
  tiempo: TiempoComida;
}

export interface ResultadoMotor {
  asignaciones: AsignacionMotor[];
  avisos: AvisoSinSugerencia[];
}

/** `OTRA` no es una proteína concreta: no se compara para RN-02. */
const comparable = (p: ProteinaPrincipal) => p !== 'OTRA';

export interface FaltanteMotor {
  tiempo: TiempoComida;
  cantidad: number;
}

/** CA-19.3: cuántos platillos faltan en cada tiempo activo para llegar al mínimo. */
export function platillosFaltantes(
  tiempos: readonly TiempoComida[],
  cantidadPorTiempo: Readonly<Partial<Record<TiempoComida, number>>>,
  minimo = MINIMO_PLATILLOS_POR_TIEMPO,
): FaltanteMotor[] {
  return tiempos
    .map((tiempo) => ({ tiempo, cantidad: minimo - (cantidadPorTiempo[tiempo] ?? 0) }))
    .filter((f) => f.cantidad > 0);
}

/** Texto de CA-19.3: "Faltan 3 platillos de Cena" / "Faltan 1 platillo de Almuerzo". */
export function textoFaltantes(
  faltantes: readonly FaltanteMotor[],
  nombreTiempo: (t: TiempoComida) => string,
): string {
  return faltantes
    .map(
      (f) =>
        `Faltan ${f.cantidad} ${f.cantidad === 1 ? 'platillo' : 'platillos'} de ${nombreTiempo(f.tiempo)}`,
    )
    .join('. ');
}

/**
 * CU-05.1 paso 5: por cada tiempo activo, de domingo a sábado, asigna el candidato de mayor puntaje
 * que no repita platillo ni proteína del día vecino. Los fijados ocupan su espacio y también
 * cuentan para RN-02 y RN-03 de los demás días.
 */
export function asignarMenu(entrada: EntradaMotor): ResultadoMotor {
  const asignaciones: AsignacionMotor[] = [];
  const avisos: AvisoSinSugerencia[] = [];
  const fijados = entrada.fijados ?? [];
  for (const tiempo of entrada.tiempos) {
    const fijoDelDia = new Map(
      fijados.filter((f) => f.tiempo === tiempo).map((f) => [f.fecha, f.candidato]),
    );
    const usados = new Set([...fijoDelDia.values()].map((c) => c.id));
    const ordenados = ordenarPorPuntaje(entrada.candidatos[tiempo] ?? []);
    const dia: (CandidatoMotor | null)[] = [];
    entrada.fechas.forEach((fecha, i) => {
      const fijo = fijoDelDia.get(fecha);
      if (fijo) {
        dia.push(fijo);
        asignaciones.push({ fecha, tiempo, candidato: fijo, fijado: true });
        return;
      }
      const anterior = dia[i - 1]?.proteina;
      const siguiente = fijoDelDia.get(entrada.fechas[i + 1] ?? '')?.proteina;
      const elegido =
        ordenados.find(
          (c) =>
            !usados.has(c.id) &&
            (!comparable(c.proteina) || (c.proteina !== anterior && c.proteina !== siguiente)),
        ) ?? null;
      if (elegido) usados.add(elegido.id);
      else avisos.push({ codigo: 'SIN_SUGERENCIA', fecha, tiempo });
      dia.push(elegido);
      asignaciones.push({ fecha, tiempo, candidato: elegido, fijado: false });
    });
  }
  return { asignaciones, avisos };
}

/** Otro espacio del mismo tiempo de comida, para revisar RN-02 y RN-03 de una alternativa. */
export interface EspacioVecino {
  fecha: string;
  platilloId: string | null;
  proteina: ProteinaPrincipal | null;
}

export interface EntradaAlternativa {
  /** Día del espacio para el que se pide otra opción. */
  fecha: string;
  /** Candidatos del tiempo de comida del espacio, ya puntuados (CU-05.2). */
  candidatos: readonly CandidatoMotor[];
  /** Platillos que no se vuelven a ofrecer: el actual y los ya mostrados para ese espacio. */
  excluidos: readonly string[];
  /** Los demás espacios de la semana en ese mismo tiempo de comida. */
  otros: readonly EspacioVecino[];
}

/**
 * CU-05.5 paso 3 y 4: el mejor candidato que no sea el actual ni uno ya mostrado, que no esté ya
 * en la semana (RN-03) ni repita proteína con el día anterior o el siguiente (RN-02). `null` si
 * no queda ninguno ("No hay más alternativas para este día").
 */
export function siguienteAlternativa(e: EntradaAlternativa): CandidatoMotor | null {
  const fuera = new Set(e.excluidos);
  for (const o of e.otros) if (o.platilloId) fuera.add(o.platilloId);
  const proteinaDe = (fecha: string) => e.otros.find((o) => o.fecha === fecha)?.proteina;
  const anterior = proteinaDe(diaSiguiente(e.fecha, -1));
  const siguiente = proteinaDe(diaSiguiente(e.fecha, 1));
  return (
    ordenarPorPuntaje(e.candidatos).find(
      (c) =>
        !fuera.has(c.id) &&
        (!comparable(c.proteina) || (c.proteina !== anterior && c.proteina !== siguiente)),
    ) ?? null
  );
}
