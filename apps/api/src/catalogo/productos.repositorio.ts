import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  asc,
  categoria,
  eq,
  ne,
  or,
  platillo,
  platilloIngrediente,
  producto,
  sql,
  unidad,
  type Db,
  type AnyPgColumn,
  type SQL,
} from '@menu/db';
import type { MagnitudUnidad, TipoProducto } from '@menu/shared';
import { esViolacionUnicidad } from '../comun/postgres';
import { DB } from '../database/database.constants';
import type { PlatilloAfectado, VistaCategoria, VistaUnidad } from './catalogo.tipos';
import { desplazamiento, patronContiene } from './paginacion';

/** Ya existe un producto con el mismo nombre normalizado y presentación (índice único). */
export class ProductoDuplicadoError extends Error {
  constructor() {
    super('Producto duplicado');
  }
}

/** Producto con su categoría y unidad de presentación (una fila del JOIN). */
export interface FilaProducto {
  id: string;
  nombre: string;
  tipo: TipoProducto;
  unidadCompra: string;
  presentacionCantidad: string;
  activo: boolean;
  categoriaId: string;
  categoriaCodigo: string;
  categoriaNombre: string;
  unidadId: string;
  unidadCodigo: string;
  unidadNombre: string;
  unidadMagnitud: MagnitudUnidad;
  unidadFactorBase: string | null;
}

export interface FiltrosProductos {
  /** Texto ya normalizado (sin tildes ni mayúsculas). */
  q?: string;
  tipo?: TipoProducto;
  categoria?: string;
  /** null = activos e inactivos. */
  activo: boolean | null;
}

export interface DatosProducto {
  nombre: string;
  nombreNormalizado: string;
  tipo: TipoProducto;
  categoriaId: string;
  unidadCompra: string;
  presentacionCantidad: string;
  presentacionUnidadId: string;
}

const COLUMNAS = {
  id: producto.id,
  nombre: producto.nombre,
  tipo: producto.tipo,
  unidadCompra: producto.unidadCompra,
  presentacionCantidad: producto.presentacionCantidad,
  activo: producto.activo,
  categoriaId: categoria.id,
  categoriaCodigo: categoria.codigo,
  categoriaNombre: categoria.nombre,
  unidadId: unidad.id,
  unidadCodigo: unidad.codigo,
  unidadNombre: unidad.nombre,
  unidadMagnitud: unidad.magnitud,
  unidadFactorBase: unidad.factorBase,
};

/** Similitud mínima por palabra (pg_trgm `word_similarity`) para aceptar errores de escritura. */
export const UMBRAL_SIMILITUD_BUSQUEDA = 0.5;

/**
 * Coincidencia por texto con pg_trgm sobre `nombre_normalizado` (índice GIN, DM-08): contiene
 * el texto o se le parece por palabra con similitud ≥ 0.5, así "pechga" encuentra "Pechuga de
 * pollo". El texto llega normalizado, sin tildes ni mayúsculas.
 */
export function coincideTexto(columna: AnyPgColumn, q: string): SQL {
  return or(
    sql`${columna} LIKE ${patronContiene(q)}`,
    sql`word_similarity(${q}, ${columna}) >= ${UMBRAL_SIMILITUD_BUSQUEDA}`,
  ) as SQL;
}

/** Acceso a `producto`, `unidad` y `categoria` (catálogo global, D-05). */
@Injectable()
export class ProductosRepositorio {
  constructor(@Inject(DB) private readonly db: Db) {}

  async unidades(): Promise<VistaUnidad[]> {
    const filas = await this.db
      .select()
      .from(unidad)
      .orderBy(asc(unidad.magnitud), asc(unidad.factorBase));
    return filas.map((u) => ({
      id: u.id,
      codigo: u.codigo,
      nombre: u.nombre,
      magnitud: u.magnitud as MagnitudUnidad,
      factorBase: u.factorBase,
    }));
  }

  async unidad(id: string): Promise<VistaUnidad | undefined> {
    return (await this.unidades()).find((u) => u.id === id);
  }

  async categorias(): Promise<VistaCategoria[]> {
    const filas = await this.db.select().from(categoria).orderBy(asc(categoria.orden));
    return filas.map(({ id, codigo, nombre, orden }) => ({ id, codigo, nombre, orden }));
  }

  async existeCategoria(id: string): Promise<boolean> {
    const [fila] = await this.db
      .select({ id: categoria.id })
      .from(categoria)
      .where(eq(categoria.id, id))
      .limit(1);
    return Boolean(fila);
  }

  private consulta() {
    return this.db
      .select(COLUMNAS)
      .from(producto)
      .innerJoin(categoria, eq(categoria.id, producto.categoriaId))
      .innerJoin(unidad, eq(unidad.id, producto.presentacionUnidadId));
  }

  async buscar(id: string): Promise<FilaProducto | undefined> {
    const [fila] = await this.consulta().where(eq(producto.id, id)).limit(1);
    return fila as FilaProducto | undefined;
  }

  /** Página de productos con el total; con texto, primero los más parecidos. */
  async listar(
    filtros: FiltrosProductos,
    pagina: number,
    tamano: number,
  ): Promise<{ filas: FilaProducto[]; total: number }> {
    const condiciones: SQL[] = [];
    if (filtros.activo !== null) condiciones.push(eq(producto.activo, filtros.activo));
    // Igual que `tipoCoincide` de @menu/shared: AMBOS aparece al filtrar por cualquiera.
    if (filtros.tipo && filtros.tipo !== 'AMBOS') {
      condiciones.push(or(eq(producto.tipo, filtros.tipo), eq(producto.tipo, 'AMBOS')) as SQL);
    }
    if (filtros.categoria) condiciones.push(eq(categoria.codigo, filtros.categoria));
    if (filtros.q) condiciones.push(coincideTexto(producto.nombreNormalizado, filtros.q));
    const donde = and(...condiciones);

    const orden = filtros.q
      ? [
          sql`word_similarity(${filtros.q}, ${producto.nombreNormalizado}) DESC`,
          asc(producto.nombreNormalizado),
        ]
      : [asc(producto.nombreNormalizado)];
    const filas = await this.consulta()
      .where(donde)
      .orderBy(...orden, asc(producto.id))
      .limit(tamano)
      .offset(desplazamiento(pagina, tamano));
    const [conteo] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(producto)
      .innerJoin(categoria, eq(categoria.id, producto.categoriaId))
      .where(donde);
    return { filas: filas as FilaProducto[], total: conteo?.total ?? 0 };
  }

  /** CU-03.3 E2: mismo nombre normalizado y misma presentación (cantidad y unidad). */
  async buscarDuplicado(
    nombreNormalizado: string,
    cantidad: string,
    unidadId: string,
    excluirId?: string,
  ): Promise<FilaProducto | undefined> {
    const condiciones = [
      eq(producto.nombreNormalizado, nombreNormalizado),
      sql`${producto.presentacionCantidad} = ${cantidad}::numeric`,
      eq(producto.presentacionUnidadId, unidadId),
    ];
    if (excluirId) condiciones.push(ne(producto.id, excluirId));
    const [fila] = await this.consulta()
      .where(and(...condiciones))
      .limit(1);
    return fila as FilaProducto | undefined;
  }

  /** Inserta y devuelve el id; `ProductoDuplicadoError` si el índice único lo rechaza. */
  async crear(datos: DatosProducto): Promise<string> {
    try {
      const [fila] = await this.db.insert(producto).values(datos).returning({ id: producto.id });
      return (fila as { id: string }).id;
    } catch (error) {
      if (esViolacionUnicidad(error)) throw new ProductoDuplicadoError();
      throw error;
    }
  }

  async actualizar(id: string, datos: Partial<DatosProducto>): Promise<void> {
    try {
      await this.db.update(producto).set(datos).where(eq(producto.id, id));
    } catch (error) {
      if (esViolacionUnicidad(error)) throw new ProductoDuplicadoError();
      throw error;
    }
  }

  async cambiarActivo(id: string, activo: boolean): Promise<boolean> {
    const filas = await this.db
      .update(producto)
      .set({ activo })
      .where(eq(producto.id, id))
      .returning({ id: producto.id });
    return filas.length > 0;
  }

  /** Platillos del hogar que usan el producto (solo del hogar de quien consulta, RNF-06). */
  async platillosQueUsan(productoId: string, hogarId: string): Promise<PlatilloAfectado[]> {
    return this.db
      .select({ id: platillo.id, nombre: platillo.nombre })
      .from(platilloIngrediente)
      .innerJoin(platillo, eq(platillo.id, platilloIngrediente.platilloId))
      .where(and(eq(platilloIngrediente.productoId, productoId), eq(platillo.hogarId, hogarId)))
      .orderBy(asc(platillo.nombreNormalizado));
  }

  /** `true` si algún platillo de cualquier hogar usa el producto. */
  async enUso(productoId: string): Promise<boolean> {
    const [fila] = await this.db
      .select({ id: platilloIngrediente.id })
      .from(platilloIngrediente)
      .where(eq(platilloIngrediente.productoId, productoId))
      .limit(1);
    return Boolean(fila);
  }
}
