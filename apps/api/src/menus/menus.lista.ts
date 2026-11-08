import {
  consolidarLista,
  fusionarDespensa,
  type DespensaDeLista,
  type ItemDeLista,
} from '@menu/shared';
import type { DatosListaPlatillo } from './menus.repositorio';

/**
 * CU-07.1 y CU-07.2: ingredientes de cada comida escalados con la Σ de factores del menú (D-04),
 * convertidos a la unidad de compra y sumados por producto, más los productos de despensa que
 * entran en la lista. Un platillo sin ingredientes no aporta. Lo usan la aprobación y la edición
 * de un menú ya aprobado, para que ambas calculen exactamente igual.
 */
export function itemsDelMenu(
  detalles: readonly { id: string; platilloId: string | null }[],
  platillos: ReadonlyMap<string, DatosListaPlatillo>,
  sumaFactoresPorcion: number,
  despensa: readonly DespensaDeLista[],
): ItemDeLista[] {
  const ingredientes = detalles.flatMap((d) =>
    (d.platilloId ? (platillos.get(d.platilloId)?.ingredientes ?? []) : []).map((i) => ({
      ...i,
      menuDetalleId: d.id,
    })),
  );
  return fusionarDespensa(consolidarLista(ingredientes, sumaFactoresPorcion), despensa);
}
