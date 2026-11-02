/**
 * Validaciones de los cambios manuales al menú (M06 · CU-06.1, HU-24): funciones puras.
 * Al editar o mover un platillo se revisan RN-02 (misma proteína en días consecutivos del mismo
 * tiempo) y RN-03 (platillo repetido en la semana y tiempo); el usuario puede confirmarlas.
 */
import { NOMBRES_PROTEINA, type ProteinaPrincipal } from './catalogo';
import type { TiempoComida } from './enums';

/** Espacio día × tiempo del menú tal como está (o quedaría) después del cambio. */
export interface EspacioPlan {
  fecha: string;
  tiempo: TiempoComida;
  platilloId: string | null;
  nombre: string | null;
  proteina: ProteinaPrincipal | null;
}

export interface EspacioRevisado {
  fecha: string;
  tiempo: TiempoComida;
}

export type CodigoAdvertenciaPlan = 'RN02_PROTEINA_CONSECUTIVA' | 'RN03_PLATILLO_REPETIDO';

export interface AdvertenciaPlan {
  codigo: CodigoAdvertenciaPlan;
  fecha: string;
  tiempo: TiempoComida;
  mensaje: string;
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** "jueves" para 2026-11-05 (calendario, sin zona horaria). */
export const nombreDiaSemana = (fecha: string): string =>
  DIAS[new Date(`${fecha}T00:00:00.000Z`).getUTCDay()]!;

/** La fecha `dias` días después (o antes, si es negativo) en calendario, sin zona horaria. */
export const diaSiguiente = (fecha: string, dias: number): string => {
  const d = new Date(`${fecha}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

/** `OTRA` no es una proteína concreta: no se compara para RN-02. */
const comparable = (p: ProteinaPrincipal | null): p is ProteinaPrincipal =>
  p !== null && p !== 'OTRA';

/**
 * Advertencias de los espacios `revisar` dentro de `plan` (el menú ya con el cambio aplicado):
 * RN-02 con el día anterior y siguiente del mismo tiempo, RN-03 con cualquier otro espacio del
 * mismo tiempo. Cada par o repetición se informa una sola vez, en orden cronológico.
 */
export function advertenciasDePlan(
  plan: readonly EspacioPlan[],
  revisar: readonly EspacioRevisado[],
): AdvertenciaPlan[] {
  const clave = (fecha: string, tiempo: TiempoComida) => `${tiempo}|${fecha}`;
  const porEspacio = new Map(plan.map((e) => [clave(e.fecha, e.tiempo), e]));
  const vistas = new Set<string>();
  const advertencias: AdvertenciaPlan[] = [];
  for (const { fecha, tiempo } of revisar) {
    const e = porEspacio.get(clave(fecha, tiempo));
    if (!e?.platilloId) continue;
    if (comparable(e.proteina)) {
      for (const vecinaFecha of [diaSiguiente(fecha, -1), diaSiguiente(fecha, 1)]) {
        const v = porEspacio.get(clave(vecinaFecha, tiempo));
        if (!v || v.proteina !== e.proteina) continue;
        const [a, b] = [fecha, vecinaFecha].sort();
        const par = `02|${tiempo}|${a}`;
        if (vistas.has(par)) continue;
        vistas.add(par);
        advertencias.push({
          codigo: 'RN02_PROTEINA_CONSECUTIVA',
          fecha: a!,
          tiempo,
          mensaje: `Proteína ${NOMBRES_PROTEINA[e.proteina].toLowerCase()} repetida en días consecutivos (${nombreDiaSemana(a!)} y ${nombreDiaSemana(b!)})`,
        });
      }
    }
    const otros = plan
      .filter((o) => o.tiempo === tiempo && o.fecha !== fecha && o.platilloId === e.platilloId)
      .map((o) => o.fecha)
      .sort();
    if (otros.length > 0) {
      const dias = [fecha, ...otros].sort();
      const grupo = `03|${tiempo}|${e.platilloId}`;
      if (vistas.has(grupo)) continue;
      vistas.add(grupo);
      advertencias.push({
        codigo: 'RN03_PLATILLO_REPETIDO',
        fecha: dias[0]!,
        tiempo,
        mensaje: `${e.nombre} se repite en la semana (${dias.map(nombreDiaSemana).join(', ')})`,
      });
    }
  }
  return advertencias;
}
