import {
  and,
  asc,
  categoria,
  despensaItem,
  eq,
  inArray,
  producto,
  unidad,
  type Db,
} from '@menu/db';
import { aCentavos, deCentavos, limpiarTexto } from '@menu/shared';
import { Problema } from '../comun/problema';
import type { TransaccionHistorial } from '../historial/historial.repositorio';
import type { FilaLista, GastoSemanal, ResumenLista } from './importaciones.tipos';

type Lector = Db | TransaccionHistorial;
type Producto = typeof producto.$inferSelect;

/** Categoría de los productos que crea la carga: se reclasifican después en el catálogo. */
export const CATEGORIA_POR_DEFECTO = 'otros';
/** Frecuencia provisional de la despensa hasta confirmar PA-03. */
export const FRECUENCIA_INICIAL = 'MENSUAL' as const;

const sumaCentavos = (valores: (string | null)[]) => {
  const centavos = valores.flatMap((v) => (v === null ? [] : [aCentavos(v)!]));
  return centavos.length ? centavos.reduce((a, b) => a + b, 0) : null;
};

/** Una entrada por lista con su cantidad de productos, total de precios y productos nuevos. */
export function resumirListas(filas: FilaLista[], existentes: ReadonlySet<string>): ResumenLista[] {
  const listas = new Map<string, FilaLista[]>();
  for (const f of filas) {
    const clave = `${f.tipo}:${f.lista}`;
    listas.set(clave, [...(listas.get(clave) ?? []), f]);
  }
  return [...listas.values()].map((grupo) => {
    const total = sumaCentavos(grupo.map((f) => f.precio));
    return {
      lista: grupo[0]!.lista,
      tipo: grupo[0]!.tipo,
      productos: grupo.length,
      total: total === null ? null : deCentavos(total),
      nuevos: new Set(
        grupo.filter((f) => !existentes.has(f.nombreNormalizado)).map((f) => f.nombreNormalizado),
      ).size,
    };
  });
}

/** Mínimo, máximo y promedio (al centavo) del gasto de las semanas que lo traen. */
export function resumirGasto(gastos: (string | null)[]): GastoSemanal | null {
  const centavos = gastos.flatMap((g) => (g === null ? [] : [aCentavos(g)!]));
  if (!centavos.length) return null;
  return {
    semanas: centavos.length,
    minimo: deCentavos(Math.min(...centavos)),
    maximo: deCentavos(Math.max(...centavos)),
    promedio: deCentavos(Math.round(centavos.reduce((a, b) => a + b, 0) / centavos.length)),
  };
}

/** Códigos de unidad del catálogo, para validar la presentación de cada fila. */
export async function codigosDeUnidad(db: Lector) {
  return new Set((await db.select({ codigo: unidad.codigo }).from(unidad)).map((u) => u.codigo));
}

/** Marca como error las presentaciones con una unidad que el catálogo no conoce. */
export function validarPresentaciones(filas: FilaLista[], unidades: ReadonlySet<string>) {
  for (const f of filas)
    if (f.presentacion && !unidades.has(f.presentacion.unidad))
      f.errores.push({
        columna: 'presentacion',
        motivo: `La unidad "${f.presentacion.unidad}" no existe en el catálogo`,
      });
}

/** Nombres normalizados de los productos activos del catálogo común entre los dados. */
export async function productosExistentes(db: Lector, nombres: string[]) {
  if (!nombres.length) return new Set<string>();
  const filas = await db
    .select({ nombre: producto.nombreNormalizado })
    .from(producto)
    .where(and(inArray(producto.nombreNormalizado, nombres), eq(producto.activo, true)));
  return new Set(filas.map((f) => f.nombre));
}

/**
 * Al confirmar: asocia cada producto de las listas al catálogo común (o lo crea, sin ocupar
 * el catálogo con duplicados) y registra los de las listas de despensa como ítems del hogar.
 * Es repetible: volver a cargar actualiza la despensa y no duplica productos.
 */
export async function materializarListas(
  tx: TransaccionHistorial,
  hogarId: string,
  filas: FilaLista[],
) {
  const nombres = [...new Set(filas.map((f) => f.nombreNormalizado))];
  const unidades = new Map((await tx.select().from(unidad)).map((u) => [u.id, u]));
  const idUnidad = new Map([...unidades.values()].map((u) => [u.codigo, u.id]));
  const candidatos = await tx
    .select()
    .from(producto)
    .where(and(inArray(producto.nombreNormalizado, nombres), eq(producto.activo, true)))
    .orderBy(asc(producto.createdAt), asc(producto.id));
  const porNombre = new Map<string, Producto[]>();
  for (const p of candidatos)
    porNombre.set(p.nombreNormalizado, [...(porNombre.get(p.nombreNormalizado) ?? []), p]);
  let categoriaId: string | undefined;
  const ids = new Map<string, string>();
  let productosCreados = 0;
  for (const nombre of nombres) {
    const propias = filas.filter((f) => f.nombreNormalizado === nombre);
    const fila = propias[0]!;
    const existentes = porNombre.get(nombre) ?? [];
    const exacto = fila.presentacion
      ? existentes.find(
          (p) =>
            Number(p.presentacionCantidad) === Number(fila.presentacion!.cantidad) &&
            unidades.get(p.presentacionUnidadId)?.codigo === fila.presentacion!.unidad,
        )
      : undefined;
    const elegido = exacto ?? existentes[0];
    if (elegido) {
      ids.set(nombre, elegido.id);
      continue;
    }
    categoriaId ??= (
      await tx
        .select({ id: categoria.id })
        .from(categoria)
        .where(eq(categoria.codigo, CATEGORIA_POR_DEFECTO))
    )[0]?.id;
    const presentacionUnidadId = idUnidad.get(fila.presentacion?.unidad ?? 'unidad');
    if (!categoriaId || !presentacionUnidadId)
      throw new Problema(
        409,
        'CATALOGO_BASE_FALTANTE',
        'Faltan la categoría "Otros" o las unidades base del catálogo. Ejecuta la semilla de datos',
      );
    const tipos = new Set(propias.map((f) => f.tipo));
    const presentacionCantidad = fila.presentacion?.cantidad ?? '1';
    const [creado] = await tx
      .insert(producto)
      .values({
        nombre: limpiarTexto(fila.producto),
        nombreNormalizado: nombre,
        tipo: tipos.size > 1 ? 'AMBOS' : fila.tipo === 'DESPENSA' ? 'DESPENSA' : 'INGREDIENTE',
        categoriaId,
        unidadCompra: fila.unidadCompra,
        presentacionCantidad,
        presentacionUnidadId,
      })
      .onConflictDoNothing()
      .returning({ id: producto.id });
    if (!creado)
      throw new Problema(
        409,
        'PRODUCTO_INACTIVO',
        `El producto "${fila.producto}" existe inactivo en el catálogo. Reactívalo y vuelve a cargar`,
      );
    productosCreados++;
    ids.set(nombre, creado.id);
  }
  const despensa = filas.filter((f) => f.tipo === 'DESPENSA');
  for (const f of despensa)
    await tx
      .insert(despensaItem)
      .values({
        hogarId,
        productoId: ids.get(f.nombreNormalizado)!,
        cantidad: f.cantidad,
        frecuencia: FRECUENCIA_INICIAL,
        precioReferencia: f.precio,
      })
      .onConflictDoUpdate({
        target: [despensaItem.hogarId, despensaItem.productoId],
        set: {
          cantidad: f.cantidad,
          precioReferencia: f.precio,
          activo: true,
          updatedAt: new Date(),
        },
      });
  return { productosCreados, despensaCargada: despensa.length };
}
