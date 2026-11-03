/**
 * Avance de la compra por comida (M07 · CU-07.6, HU-43, RN-13): función pura que usan la API y la app,
 * esta última para calcularlo en el dispositivo sin conexión. Un ítem está cubierto cuando está
 * comprado o marcado "Ya lo tengo"; un producto compartido por varias comidas cuenta en todas.
 */
import { ORDEN_TIEMPOS, type TiempoComida } from './enums';

/** Lo que el cálculo necesita de un ítem vigente de la lista (los eliminados no se envían). */
export interface ItemParaAvance {
  id: string;
  producto: string;
  estado: 'PENDIENTE' | 'COMPRADO' | 'YA_LO_TENGO';
  /** Comidas (detalles del menú) que originan el ítem; vacío en ítems agregados a mano. */
  comidas: readonly string[];
}

/** Una comida programada del menú aprobado. */
export interface ComidaDelMenu {
  menuDetalleId: string;
  fecha: string;
  tiempo: TiempoComida;
  /** null = espacio sin platillo: no es una comida y no entra en el avance. */
  platillo: { id: string; nombre: string } | null;
}

export interface AvanceComida {
  menuDetalleId: string;
  fecha: string;
  tiempo: TiempoComida;
  platillo: { id: string; nombre: string };
  cubiertos: number;
  total: number;
  /** RN-13: todos los ingredientes de la comida están cubiertos (y tiene al menos uno). */
  listaParaPreparar: boolean;
  /** E2: el platillo no tiene ingredientes en la lista; nunca queda lista para preparar. */
  sinIngredientes: boolean;
  pendientes: { itemId: string; producto: string }[];
}

export interface AvanceLista {
  /** Productos cubiertos sobre productos de la lista; el porcentaje va redondeado al entero. */
  general: { cubiertos: number; total: number; porcentaje: number };
  comidas: AvanceComida[];
}

const cubierto = (i: ItemParaAvance) => i.estado !== 'PENDIENTE';

/** CU-07.6 pasos 2 a 5: avance de cada comida (en orden de fecha y tiempo) y avance general. */
export function avanceDeLista(
  items: readonly ItemParaAvance[],
  comidas: readonly ComidaDelMenu[],
): AvanceLista {
  const cubiertos = items.filter(cubierto).length;
  const comidasConPlatillo = comidas.filter(
    (c): c is ComidaDelMenu & { platillo: { id: string; nombre: string } } => c.platillo !== null,
  );
  return {
    general: {
      cubiertos,
      total: items.length,
      porcentaje: items.length === 0 ? 0 : Math.round((cubiertos * 100) / items.length),
    },
    comidas: [...comidasConPlatillo]
      .sort(
        (a, b) =>
          a.fecha.localeCompare(b.fecha) ||
          ORDEN_TIEMPOS.indexOf(a.tiempo) - ORDEN_TIEMPOS.indexOf(b.tiempo),
      )
      .map((c) => {
        const deLaComida = items.filter((i) => i.comidas.includes(c.menuDetalleId));
        const hechos = deLaComida.filter(cubierto).length;
        return {
          menuDetalleId: c.menuDetalleId,
          fecha: c.fecha,
          tiempo: c.tiempo,
          platillo: c.platillo,
          cubiertos: hechos,
          total: deLaComida.length,
          listaParaPreparar: deLaComida.length > 0 && hechos === deLaComida.length,
          sinIngredientes: deLaComida.length === 0,
          pendientes: deLaComida
            .filter((i) => !cubierto(i))
            .map((i) => ({ itemId: i.id, producto: i.producto })),
        };
      }),
  };
}
