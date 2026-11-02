/**
 * Frase resumen del motivo de una sugerencia (M05 · CU-05.4, HU-22): función pura.
 * Explica con palabras el factor que más pesó en el puntaje o el origen de la asignación.
 */
import type { FactoresPuntaje, PesosMotor } from './puntaje';

export type OrigenAsignacion =
  | 'MOTOR'
  | 'REEMPLAZO_PRESUPUESTO'
  | 'ALTERNATIVA'
  | 'USUARIO'
  | 'HISTORICO';

export interface EntradaMotivo {
  origen: OrigenAsignacion;
  /** Factores guardados al generar; null si el espacio no los tiene (p. ej. lo eligió el usuario). */
  factores: FactoresPuntaje | null;
  /** Pesos usados al generar el menú. */
  pesos: PesosMotor | null;
  /** Con costo incompleto el Ahorro es neutro (D-18) y no puede ser la razón principal. */
  costoIncompleto: boolean;
  /** Detalle del reemplazo por presupuesto, p. ej. "Q22.00 más barato". */
  nota?: string | null;
}

const FACTORES = ['preferencia', 'novedad', 'ahorro', 'afinidad'] as const;

/** Razón en lenguaje de hogar para cada factor. */
const RAZON: Readonly<Record<(typeof FACTORES)[number], string>> = {
  preferencia: 'es de sus favoritos o está muy bien calificado',
  novedad: 'hace tiempo que no se prepara',
  ahorro: 'cuesta menos',
  afinidad: 'lo preparan seguido',
};

/** Factor con mayor aporte (peso × valor); en empate gana el primero en el orden de los factores. */
export function factorPrincipal(
  factores: FactoresPuntaje,
  pesos: PesosMotor,
  costoIncompleto: boolean,
): (typeof FACTORES)[number] | null {
  let mejor: (typeof FACTORES)[number] | null = null;
  let aporteMejor = 0;
  for (const f of FACTORES) {
    if (f === 'ahorro' && costoIncompleto) continue;
    const aporte = pesos[f] * factores[f];
    if (aporte > aporteMejor) {
      mejor = f;
      aporteMejor = aporte;
    }
  }
  return mejor;
}

function razonDelMotor(e: EntradaMotivo): string | null {
  if (!e.factores || !e.pesos) return null;
  const f = factorPrincipal(e.factores, e.pesos, e.costoIncompleto);
  return f ? `Sugerido sobre todo porque ${RAZON[f]}` : null;
}

/** Frase corta que acompaña al desglose de factores. */
export function resumenMotivo(e: EntradaMotivo): string {
  switch (e.origen) {
    case 'USUARIO':
      return 'Elegido por el usuario';
    case 'HISTORICO':
      return 'Platillo de una semana del historial';
    case 'REEMPLAZO_PRESUPUESTO':
      return e.nota ? `Reemplazo por presupuesto: ${e.nota}` : 'Reemplazo por presupuesto';
    case 'ALTERNATIVA': {
      const razon = razonDelMotor(e);
      return razon ? `Alternativa pedida. ${razon}` : 'Alternativa pedida';
    }
    default:
      return razonDelMotor(e) ?? 'Sugerido por el motor';
  }
}
