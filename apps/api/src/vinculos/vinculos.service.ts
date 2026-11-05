import { Injectable } from '@nestjs/common';
import {
  cantidadValida,
  factorVinculo,
  formatearCantidad,
  limpiarTexto,
  mensajeUnidadNoConvertible,
  normalizarNombreCatalogo,
  urlEnDominio,
} from '@menu/shared';
import { Problema } from '../comun/problema';
import type { ActualizarVinculoDto, CrearVinculoDto } from './dto/vinculos.dto';
import {
  VinculosRepositorio,
  type FilaPrecioVinculo,
  type FilaSupermercadoVinculo,
  type FilaVinculoCompleto,
} from './vinculos.repositorio';
import type { VistaSupermercado, VistaVinculo } from './vinculos.tipos';

/** "2.500000" → "2.5", "1.000000" → "1". */
const sinCeros = (decimal: string): string =>
  decimal.includes('.') ? decimal.replace(/0+$/, '').replace(/\.$/, '') : decimal;

const campoInvalido = (codigo: string, campo: string, mensaje: string) =>
  new Problema(422, codigo, mensaje, { errores: [{ campo, mensaje }] });

/** Texto opcional: sin espacios de más, y vacío o ausente es `null`. */
const textoOpcional = (valor: string | null | undefined): string | null => {
  const limpio = limpiarTexto(valor ?? '');
  return limpio === '' ? null : limpio;
};

/** M08 · CU-08.2 — vínculo de un producto con su equivalente en cada supermercado (HU-35). */
@Injectable()
export class VinculosService {
  constructor(private readonly repo: VinculosRepositorio) {}

  async supermercados(): Promise<VistaSupermercado[]> {
    return (await this.repo.supermercados()).map((s) => ({
      id: s.id,
      nombre: s.nombre,
      requiereEnlace: s.soportaExtraccion,
      dominio: s.dominio,
    }));
  }

  async listar(hogarId: string, productoId: string): Promise<VistaVinculo[]> {
    await this.productoExistente(productoId);
    return this.vistas(hogarId, await this.repo.vinculosDe(productoId));
  }

  /**
   * CU-08.2: valida la presentación, calcula el factor y guarda el vínculo activo. Si ya hay uno
   * activo en ese supermercado es 409 `VINCULO_ACTIVO_EXISTE`, salvo que se pida reemplazarlo.
   */
  async crear(
    hogarId: string,
    usuarioId: string,
    productoId: string,
    dto: CrearVinculoDto,
    reemplazar: boolean,
  ): Promise<VistaVinculo> {
    const producto = await this.productoExistente(productoId);
    const tienda = await this.repo.supermercado(dto.supermercadoId);
    if (!tienda) throw new Problema(404, 'NO_ENCONTRADO', 'El supermercado no existe.');

    const nombreTienda = textoOpcional(dto.nombreTienda);
    if (!nombreTienda) {
      throw campoInvalido(
        'NOMBRE_TIENDA_OBLIGATORIO',
        'nombreTienda',
        'Escribe el nombre del producto en la tienda',
      );
    }
    const cantidad = cantidadValida(dto.presentacionCantidad);
    if (!cantidad) {
      throw campoInvalido(
        'PRESENTACION_INVALIDA',
        'presentacionCantidad',
        'La presentación debe ser un número mayor que 0',
      );
    }
    const unidadTienda = await this.repo.unidad(dto.presentacionUnidadId);
    if (!unidadTienda) {
      throw campoInvalido(
        'UNIDAD_NO_EXISTE',
        'presentacionUnidadId',
        'Elige una unidad de la lista',
      );
    }
    const factor = factorVinculo(
      { cantidad, unidad: unidadTienda },
      { cantidad: producto.presentacionCantidad, unidad: producto.unidad },
    );
    if (factor === null || factor <= 0) {
      throw campoInvalido(
        'UNIDAD_NO_CONVERTIBLE',
        'presentacionUnidadId',
        mensajeUnidadNoConvertible(producto.unidad.nombre),
      );
    }
    const { url, sku } = this.validarEnlace(tienda, textoOpcional(dto.url), textoOpcional(dto.sku));

    const existente = await this.repo.vinculoActivo(productoId, tienda.id);
    if (existente && !reemplazar) {
      const [vista] = await this.vistas(
        hogarId,
        [await this.repo.vinculo(existente)].filter((v): v is FilaVinculoCompleto => v !== null),
      );
      throw new Problema(
        409,
        'VINCULO_ACTIVO_EXISTE',
        `${producto.nombre} ya tiene un vínculo activo en ${tienda.nombre}. ¿Quieres reemplazarlo?`,
        { vinculoExistente: vista },
      );
    }

    const marca = textoOpcional(dto.marca);
    const id = await this.repo.crear(
      {
        productoId,
        supermercadoId: tienda.id,
        nombreTienda,
        marca,
        marcaNormalizada: marca ? normalizarNombreCatalogo(marca) : null,
        presentacionCantidad: String(cantidad),
        presentacionUnidadId: unidadTienda.id,
        factor: factor.toFixed(6),
        url,
        sku,
        creadoPorHogarId: hogarId,
        creadoPorUsuarioId: usuarioId,
      },
      existente,
    );
    return this.vistaDe(hogarId, id);
  }

  /** Cambia nombre en tienda, marca, URL o SKU; la presentación no se edita (se reemplaza). */
  async actualizar(hogarId: string, id: string, dto: ActualizarVinculoDto): Promise<VistaVinculo> {
    const actual = await this.repo.vinculo(id);
    if (!actual) throw new Problema(404, 'NO_ENCONTRADO', 'El vínculo no existe.');
    if (!actual.activo) {
      throw new Problema(422, 'VINCULO_INACTIVO', 'El vínculo está inactivo y no se puede editar.');
    }
    const tienda = await this.repo.supermercado(actual.supermercadoId);
    if (!tienda) throw new Problema(404, 'NO_ENCONTRADO', 'El supermercado no existe.');

    const cambios: Parameters<VinculosRepositorio['actualizar']>[1] = {};
    if (dto.nombreTienda !== undefined) {
      const nombre = textoOpcional(dto.nombreTienda);
      if (!nombre) {
        throw campoInvalido(
          'NOMBRE_TIENDA_OBLIGATORIO',
          'nombreTienda',
          'Escribe el nombre del producto en la tienda',
        );
      }
      cambios.nombreTienda = nombre;
    }
    if (dto.marca !== undefined) {
      const marca = textoOpcional(dto.marca);
      cambios.marca = marca;
      cambios.marcaNormalizada = marca ? normalizarNombreCatalogo(marca) : null;
    }
    const url = dto.url !== undefined ? textoOpcional(dto.url) : actual.url;
    const sku = dto.sku !== undefined ? textoOpcional(dto.sku) : actual.sku;
    this.validarEnlace(tienda, url, sku);
    if (dto.url !== undefined) cambios.url = url;
    if (dto.sku !== undefined) cambios.sku = sku;

    if (Object.keys(cambios).length > 0) await this.repo.actualizar(id, cambios);
    return this.vistaDe(hogarId, id);
  }

  /**
   * CU-08.2 pasos 2 y 2a: los supermercados con consulta automática piden URL o SKU; la URL tiene
   * que ser del dominio del supermercado cuando ya está registrado (E2).
   */
  private validarEnlace(
    tienda: FilaSupermercadoVinculo,
    url: string | null,
    sku: string | null,
  ): { url: string | null; sku: string | null } {
    if (tienda.soportaExtraccion && !url && !sku) {
      throw campoInvalido(
        'URL_O_SKU_REQUERIDO',
        'url',
        `Para ${tienda.nombre} indica la URL o el SKU del producto`,
      );
    }
    if (url) {
      if (!/^https?:\/\//i.test(url)) {
        throw campoInvalido('URL_INVALIDA', 'url', 'La URL debe empezar con http:// o https://');
      }
      if (tienda.dominio && !urlEnDominio(url, tienda.dominio)) {
        throw campoInvalido(
          'URL_FUERA_DE_DOMINIO',
          'url',
          `La URL no pertenece a ${tienda.dominio}`,
        );
      }
    }
    return { url, sku };
  }

  private async productoExistente(productoId: string) {
    const producto = await this.repo.producto(productoId);
    if (!producto) throw new Problema(404, 'NO_ENCONTRADO', 'El producto no existe.');
    return producto;
  }

  private async vistaDe(hogarId: string, id: string): Promise<VistaVinculo> {
    const fila = await this.repo.vinculo(id);
    return (await this.vistas(hogarId, [fila!]))[0]!;
  }

  private async vistas(hogarId: string, filas: FilaVinculoCompleto[]): Promise<VistaVinculo[]> {
    const precios = await this.repo.precios(
      hogarId,
      filas.map((f) => f.id),
    );
    const ultimo = new Map<string, FilaPrecioVinculo>();
    for (const p of precios) {
      if (!ultimo.has(p.productoSupermercadoId)) ultimo.set(p.productoSupermercadoId, p);
    }
    return filas.map((f) => {
      const p = ultimo.get(f.id);
      const cantidad = formatearCantidad(f.presentacionCantidad);
      return {
        id: f.id,
        productoId: f.productoId,
        supermercado: { id: f.supermercadoId, nombre: f.supermercado },
        nombreTienda: f.nombreTienda,
        marca: f.marca,
        presentacion: { cantidad, unidad: f.unidad, texto: `${cantidad} ${f.unidad}` },
        factor: sinCeros(f.factor),
        url: f.url,
        sku: f.sku,
        activo: f.activo,
        ultimoPrecio: p
          ? {
              precio: p.precio,
              precioNormalizado: p.precioNormalizado,
              fecha: p.fechaPrecio,
              origen: p.origen,
            }
          : null,
      };
    });
  }
}
