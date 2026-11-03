import { and, eq, inArray, isNotNull, listaCompras, listaItem, type Db } from '@menu/db';
import { promedioDeCompra, type PromedioDeCompra } from '@menu/shared';

/**
 * RN-12: promedio de compra por producto del hogar, con los precios normalizados de los ítems
 * comprados en las últimas 12 semanas. Lo usan la lista (para mostrarlo junto a la mediana) y el
 * costo de los platillos (como respaldo cuando no hay precio de mercado vigente, CA-44.4).
 */
export async function promediosDeCompra(
  db: Pick<Db, 'select'>,
  hogarId: string,
  productoIds: string[],
  hoy: Date,
): Promise<Map<string, PromedioDeCompra>> {
  const promedios = new Map<string, PromedioDeCompra>();
  if (productoIds.length === 0) return promedios;
  const filas = await db
    .select({
      productoId: listaItem.productoId,
      precioNormalizado: listaItem.precioNormalizado,
      compradoEn: listaItem.compradoEn,
    })
    .from(listaItem)
    .innerJoin(listaCompras, eq(listaCompras.id, listaItem.listaId))
    .where(
      and(
        eq(listaCompras.hogarId, hogarId),
        inArray(listaItem.productoId, productoIds),
        eq(listaItem.eliminado, false),
        eq(listaItem.estado, 'COMPRADO'),
        isNotNull(listaItem.precioNormalizado),
        isNotNull(listaItem.compradoEn),
      ),
    );
  const porProducto = new Map<string, { precioNormalizado: string; compradoEn: Date }[]>();
  for (const f of filas) {
    const lista = porProducto.get(f.productoId!) ?? [];
    lista.push({ precioNormalizado: f.precioNormalizado!, compradoEn: f.compradoEn! });
    porProducto.set(f.productoId!, lista);
  }
  for (const [productoId, compras] of porProducto) {
    const promedio = promedioDeCompra(compras, hoy);
    if (promedio) promedios.set(productoId, promedio);
  }
  return promedios;
}
