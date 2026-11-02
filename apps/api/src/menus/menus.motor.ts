import {
  SEMANAS_AFINIDAD,
  calcularPuntaje,
  diasEntre,
  type CandidatoMotor,
  type PesosMotor,
  type TiempoComida,
} from '@menu/shared';
import type { PlatilloActivo, Preparacion } from './menus.repositorio';

export interface ArgumentosCandidatos {
  tiempo: TiempoComida;
  /** Platillos activos aplicables al tiempo, sin los de ingredientes excluidos. */
  platillos: readonly PlatilloActivo[];
  preparaciones: readonly Preparacion[];
  /** Fecha desde la que se miden Novedad y Afinidad (D-19). */
  referencia: string;
  presupuestoPorComida: number;
  pesos: PesosMotor;
}

/** Última fecha de historial anterior a la semana, o null (D-19). */
export function ultimaFechaHistorial(preparaciones: readonly Preparacion[]): string | null {
  return preparaciones.reduce<string | null>(
    (ultima, p) => (ultima === null || p.fecha > ultima ? p.fecha : ultima),
    null,
  );
}

/**
 * CU-05.1 paso 4: puntúa cada platillo del tiempo con CU-05.2. Novedad usa la última vez que se
 * preparó en cualquier tiempo; Afinidad cuenta las veces en ese tiempo dentro de las últimas
 * 16 semanas y se normaliza con el máximo entre los candidatos. El costo es siempre incompleto
 * mientras no existan precios (D-18 → Ahorro 0.50).
 */
export function construirCandidatos(a: ArgumentosCandidatos): CandidatoMotor[] {
  const ultima = new Map<string, string>();
  const veces = new Map<string, number>();
  for (const p of a.preparaciones) {
    if ((ultima.get(p.platilloId) ?? '') < p.fecha) ultima.set(p.platilloId, p.fecha);
    if (p.tiempo === a.tiempo && diasEntre(p.fecha, a.referencia) <= SEMANAS_AFINIDAD * 7) {
      veces.set(p.platilloId, (veces.get(p.platilloId) ?? 0) + 1);
    }
  }
  const maximoVeces = Math.max(0, ...a.platillos.map((p) => veces.get(p.id) ?? 0));
  return a.platillos.map((p) => {
    const { factores, puntaje } = calcularPuntaje(
      {
        esFavorito: p.favorito,
        promedioCalificaciones:
          p.calificacionPromedio === null ? null : Number(p.calificacionPromedio),
        ultimaPreparacion: ultima.get(p.id) ?? null,
        costo: null,
        vecesEnVentana: veces.get(p.id) ?? 0,
      },
      { referencia: a.referencia, presupuestoPorComida: a.presupuestoPorComida, maximoVeces },
      a.pesos,
    );
    return { id: p.id, nombre: p.nombre, proteina: p.proteina, puntaje, factores, costo: null };
  });
}
