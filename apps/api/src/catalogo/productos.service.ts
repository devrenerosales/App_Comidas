import { Injectable } from '@nestjs/common';
import {
  LARGO_MAXIMO_NOMBRE_PRODUCTO,
  LARGO_MAXIMO_UNIDAD_COMPRA,
  MENSAJES_CATALOGO,
  CANTIDAD_MAXIMA,
  etiquetaProducto,
  limpiarTexto,
  normalizarNombreCatalogo,
  redondear,
} from '@menu/shared';
import { Problema } from '../comun/problema';
import type {
  Pagina,
  ProductoConAfectados,
  VistaCategoria,
  VistaProducto,
  VistaUnidad,
} from './catalogo.tipos';
import type {
  ActualizarProductoDto,
  ConsultaProductosDto,
  CrearProductoDto,
} from './dto/catalogo.dto';
import { paginar } from './paginacion';
import {
  ProductoDuplicadoError,
  ProductosRepositorio,
  type DatosProducto,
  type FilaProducto,
} from './productos.repositorio';

/** Fila del JOIN → vista de la API con la etiqueta "Arroz · bolsa 2 lb" (CA-13.1). */
export function vistaProducto(f: FilaProducto): VistaProducto {
  return {
    id: f.id,
    nombre: f.nombre,
    tipo: f.tipo,
    categoria: { id: f.categoriaId, codigo: f.categoriaCodigo, nombre: f.categoriaNombre },
    unidadCompra: f.unidadCompra,
    presentacion: {
      cantidad: f.presentacionCantidad,
      unidad: {
        id: f.unidadId,
        codigo: f.unidadCodigo,
        nombre: f.unidadNombre,
        magnitud: f.unidadMagnitud,
        factorBase: f.unidadFactorBase,
      },
    },
    etiqueta: etiquetaProducto({
      nombre: f.nombre,
      unidadCompra: f.unidadCompra,
      presentacionCantidad: f.presentacionCantidad,
      presentacionUnidad: f.unidadCodigo,
    }),
    activo: f.activo,
  };
}

/** Error 422 de un campo con código propio. */
export function problemaCampo(codigo: string, campo: string, mensaje: string): Problema {
  return new Problema(422, codigo, mensaje, { errores: [{ campo, mensaje }] });
}

/** Valida una cantidad positiva de hasta 3 decimales (numeric(10,3)) y la devuelve en texto. */
export function cantidadValida(texto: string): string | null {
  const valor = Number(texto);
  if (!Number.isFinite(valor) || valor <= 0 || valor > CANTIDAD_MAXIMA) return null;
  if (redondear(valor, 3) !== valor) return null;
  return String(valor);
}

const noEncontrado = () => new Problema(404, 'NO_ENCONTRADO', 'El producto no existe.');

/** Casos de uso del catálogo de productos común (CU-03.3, RF-13, D-05). */
@Injectable()
export class ProductosService {
  constructor(private readonly productos: ProductosRepositorio) {}

  unidades(): Promise<VistaUnidad[]> {
    return this.productos.unidades();
  }

  categorias(): Promise<VistaCategoria[]> {
    return this.productos.categorias();
  }

  /** CU-03.3 pasos 1–2: lista con búsqueda pg_trgm sin tildes y filtros por tipo y categoría. */
  async listar(consulta: ConsultaProductosDto): Promise<Pagina<VistaProducto>> {
    const q = consulta.q ? normalizarNombreCatalogo(consulta.q) : undefined;
    const activo = consulta.activo === 'todos' ? null : consulta.activo !== 'false';
    const { filas, total } = await this.productos.listar(
      { q: q || undefined, tipo: consulta.tipo, categoria: consulta.categoria, activo },
      consulta.pagina,
      consulta.tamano,
    );
    return paginar(filas.map(vistaProducto), consulta.pagina, consulta.tamano, total);
  }

  async obtener(id: string): Promise<VistaProducto> {
    const fila = await this.productos.buscar(id);
    if (!fila) throw noEncontrado();
    return vistaProducto(fila);
  }

  /** CU-03.3 pasos 3–6 (también desde el buscador de ingredientes, CU-03.2 3a). */
  async crear(dto: CrearProductoDto): Promise<VistaProducto> {
    const datos = await this.validar(dto);
    await this.rechazarDuplicado(datos);
    let id: string;
    try {
      id = await this.productos.crear(datos);
    } catch (error) {
      if (error instanceof ProductoDuplicadoError) await this.rechazarDuplicado(datos);
      throw error;
    }
    return this.obtener(id);
  }

  /** Edición del administrador del sistema: el producto es común a todos los hogares. */
  async actualizar(id: string, dto: ActualizarProductoDto): Promise<VistaProducto> {
    const actual = await this.productos.buscar(id);
    if (!actual) throw noEncontrado();
    const datos = await this.validar({
      nombre: dto.nombre ?? actual.nombre,
      tipo: dto.tipo ?? actual.tipo,
      categoriaId: dto.categoriaId ?? actual.categoriaId,
      unidadCompra: dto.unidadCompra ?? actual.unidadCompra,
      presentacionCantidad: dto.presentacionCantidad ?? actual.presentacionCantidad,
      presentacionUnidadId: dto.presentacionUnidadId ?? actual.unidadId,
    });
    if (datos.presentacionUnidadId !== actual.unidadId) {
      const nueva = await this.productos.unidad(datos.presentacionUnidadId);
      if (nueva?.magnitud !== actual.unidadMagnitud && (await this.productos.enUso(id))) {
        throw problemaCampo(
          'MAGNITUD_EN_USO',
          'presentacionUnidadId',
          MENSAJES_CATALOGO.magnitudEnUso,
        );
      }
    }
    await this.rechazarDuplicado(datos, id);
    try {
      await this.productos.actualizar(id, datos);
    } catch (error) {
      if (error instanceof ProductoDuplicadoError) await this.rechazarDuplicado(datos, id);
      throw error;
    }
    return this.obtener(id);
  }

  /**
   * CU-03.3 3a: deja de aparecer en el buscador de ingredientes; los platillos que lo usan se
   * conservan y muestran la advertencia "Ingrediente inactivo" (CA-13.2).
   */
  inactivar(id: string, hogarId: string): Promise<ProductoConAfectados> {
    return this.cambiarActivo(id, hogarId, false);
  }

  reactivar(id: string, hogarId: string): Promise<ProductoConAfectados> {
    return this.cambiarActivo(id, hogarId, true);
  }

  private async cambiarActivo(
    id: string,
    hogarId: string,
    activo: boolean,
  ): Promise<ProductoConAfectados> {
    if (!(await this.productos.cambiarActivo(id, activo))) throw noEncontrado();
    return {
      producto: await this.obtener(id),
      platillosAfectados: await this.productos.platillosQueUsan(id, hogarId),
    };
  }

  private async validar(dto: CrearProductoDto): Promise<DatosProducto> {
    const nombre = limpiarTexto(dto.nombre);
    if (!nombre) {
      throw problemaCampo(
        'NOMBRE_OBLIGATORIO',
        'nombre',
        MENSAJES_CATALOGO.nombreProductoObligatorio,
      );
    }
    if (nombre.length > LARGO_MAXIMO_NOMBRE_PRODUCTO) {
      throw problemaCampo('NOMBRE_LARGO', 'nombre', MENSAJES_CATALOGO.nombreProductoLargo);
    }
    const unidadCompra = limpiarTexto(dto.unidadCompra);
    if (!unidadCompra || unidadCompra.length > LARGO_MAXIMO_UNIDAD_COMPRA) {
      throw problemaCampo(
        'UNIDAD_COMPRA_INVALIDA',
        'unidadCompra',
        MENSAJES_CATALOGO.unidadCompraObligatoria,
      );
    }
    const cantidad = cantidadValida(dto.presentacionCantidad);
    if (!cantidad) {
      throw problemaCampo(
        'PRESENTACION_INVALIDA',
        'presentacionCantidad',
        MENSAJES_CATALOGO.presentacionInvalida,
      );
    }
    if (!(await this.productos.existeCategoria(dto.categoriaId))) {
      throw problemaCampo('CATEGORIA_NO_EXISTE', 'categoriaId', 'Elige una categoría de la lista');
    }
    if (!(await this.productos.unidad(dto.presentacionUnidadId))) {
      throw problemaCampo(
        'UNIDAD_NO_EXISTE',
        'presentacionUnidadId',
        'Elige una unidad de la lista',
      );
    }
    return {
      nombre,
      nombreNormalizado: normalizarNombreCatalogo(nombre),
      tipo: dto.tipo,
      categoriaId: dto.categoriaId,
      unidadCompra,
      presentacionCantidad: cantidad,
      presentacionUnidadId: dto.presentacionUnidadId,
    };
  }

  /** CU-03.3 E2 · CA-13.3: 409 con el producto existente para ofrecer abrirlo. */
  private async rechazarDuplicado(datos: DatosProducto, excluirId?: string): Promise<void> {
    const existente = await this.productos.buscarDuplicado(
      datos.nombreNormalizado,
      datos.presentacionCantidad,
      datos.presentacionUnidadId,
      excluirId,
    );
    if (!existente) return;
    const vista = vistaProducto(existente);
    throw new Problema(
      409,
      'PRODUCTO_DUPLICADO',
      MENSAJES_CATALOGO.productoDuplicado(vista.etiqueta),
      {
        existenteId: vista.id,
        existente: vista.etiqueta,
      },
    );
  }
}
