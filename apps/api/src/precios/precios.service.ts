import { Inject, Injectable } from '@nestjs/common';
import { precioDeVinculo, validarFechaCompra, validarPrecioMercado } from '@menu/shared';
import { Problema } from '../comun/problema';
import { fechaLocal } from '../configuracion/semanas';
import { VinculosRepositorio } from '../vinculos/vinculos.repositorio';
import { VinculosService } from '../vinculos/vinculos.service';
import type { VistaVinculo } from '../vinculos/vinculos.tipos';
import type { CrearPrecioDto } from './dto/precios.dto';
import { RELOJ_PRECIOS } from './precios.constants';
import { ResumenPreciosService } from './resumen-precios.service';
import { PreciosRepositorio } from './precios.repositorio';

export interface PrecioRegistrado {
  id: string;
  precio: string;
  precioNormalizado: string;
  fechaPrecio: string;
  origen: 'MANUAL';
  /** El vínculo sobre el que quedó el precio, con ese precio como el último. */
  vinculo: VistaVinculo;
  /** `true` si el vínculo se creó con este precio (flujo alterno 1a). */
  vinculoCreado: boolean;
}

/** M08 · CU-08.1 — registrar un precio a mano (HU-34). */
@Injectable()
export class PreciosService {
  constructor(
    private readonly repo: PreciosRepositorio,
    private readonly vinculosRepo: VinculosRepositorio,
    private readonly vinculos: VinculosService,
    private readonly resumen: ResumenPreciosService,
    @Inject(RELOJ_PRECIOS) private readonly reloj: () => Date,
  ) {}

  /**
   * Guarda el precio con origen MANUAL, el hogar y la fecha. E1: precio mayor que 0 con a lo sumo
   * 2 decimales. E2: fecha de compra no futura. Si el producto no tiene vínculo activo en el
   * supermercado se crea uno mínimo con la presentación indicada (1a).
   */
  async registrar(
    hogarId: string,
    usuarioId: string,
    dto: CrearPrecioDto,
  ): Promise<PrecioRegistrado> {
    const validoPrecio = validarPrecioMercado(dto.precio);
    if (!validoPrecio.ok) {
      throw this.campoInvalido('PRECIO_INVALIDO', 'precio', validoPrecio.mensaje);
    }
    const validaFecha = validarFechaCompra(dto.fechaPrecio, fechaLocal(this.reloj()));
    if (!validaFecha.ok) {
      throw this.campoInvalido(validaFecha.codigo, 'fechaPrecio', validaFecha.mensaje);
    }

    const { id: vinculoId, creado } = await this.resolverVinculo(hogarId, usuarioId, dto);
    const vinculo = (await this.vinculosRepo.vinculo(vinculoId))!;
    const normalizado = precioDeVinculo(validoPrecio.precio, vinculo.factor).toFixed(2);

    const { id } = await this.repo.insertarManual({
      productoSupermercadoId: vinculoId,
      hogarId,
      registradoPorId: usuarioId,
      precio: validoPrecio.precio,
      precioNormalizado: normalizado,
      fechaPrecio: validaFecha.fecha,
    });
    await this.resumen.recalcularProducto(hogarId, vinculo.productoId);
    return {
      id,
      precio: validoPrecio.precio,
      precioNormalizado: normalizado,
      fechaPrecio: validaFecha.fecha,
      origen: 'MANUAL',
      vinculo: await this.vinculos.vistaDe(hogarId, vinculoId),
      vinculoCreado: creado,
    };
  }

  /** El vínculo indicado, el activo del par producto + supermercado, o uno mínimo nuevo. */
  private async resolverVinculo(
    hogarId: string,
    usuarioId: string,
    dto: CrearPrecioDto,
  ): Promise<{ id: string; creado: boolean }> {
    if (dto.productoSupermercadoId) {
      const vinculo = await this.vinculosRepo.vinculo(dto.productoSupermercadoId);
      if (!vinculo) throw new Problema(404, 'NO_ENCONTRADO', 'El vínculo no existe.');
      if (!vinculo.activo) {
        throw new Problema(
          422,
          'VINCULO_INACTIVO',
          'El vínculo está inactivo: registra el precio sobre el vínculo vigente.',
        );
      }
      return { id: vinculo.id, creado: false };
    }

    if (!dto.productoId || !dto.supermercadoId) {
      throw new Problema(
        422,
        'DATOS_INCOMPLETOS',
        'Indica el producto y el supermercado del precio.',
      );
    }
    const producto = await this.vinculosRepo.producto(dto.productoId);
    if (!producto) throw new Problema(404, 'NO_ENCONTRADO', 'El producto no existe.');
    const activo = await this.vinculosRepo.vinculoActivo(dto.productoId, dto.supermercadoId);
    if (activo) return { id: activo, creado: false };

    if (dto.presentacionCantidad === undefined || !dto.presentacionUnidadId) {
      throw this.campoInvalido(
        'VINCULO_REQUERIDO',
        'presentacionCantidad',
        'Este producto no está vinculado con ese supermercado: indica la presentación en que se vende.',
      );
    }
    const creado = await this.vinculos.crear(
      hogarId,
      usuarioId,
      dto.productoId,
      {
        supermercadoId: dto.supermercadoId,
        nombreTienda: producto.nombre,
        presentacionCantidad: dto.presentacionCantidad,
        presentacionUnidadId: dto.presentacionUnidadId,
      },
      false,
    );
    return { id: creado.id, creado: true };
  }

  private campoInvalido(codigo: string, campo: string, mensaje: string): Problema {
    return new Problema(422, codigo, mensaje, { errores: [{ campo, mensaje }] });
  }
}
