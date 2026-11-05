import { Injectable } from '@nestjs/common';
import { normalizarNombreCatalogo } from '@menu/shared';
import { Problema } from '../comun/problema';
import type { GuardarMarcaDto, GuardarSupermercadosDto } from './dto/supermercados.dto';
import {
  SupermercadosRepositorio,
  type FilaPrecio,
  type FilaVinculo,
} from './supermercados.repositorio';
import type {
  MarcaElegida,
  OpcionMarca,
  SupermercadoPreferido,
  VistaMarcasProducto,
} from './supermercados.tipos';

/** "1.000" → "1", "0.500" → "0.5". */
const sinCeros = (decimal: string): string =>
  decimal.includes('.') ? decimal.replace(/0+$/, '').replace(/\.$/, '') : decimal;

/** M02 · CU-02.5 — supermercados y marcas preferidas del hogar (HU-09). */
@Injectable()
export class SupermercadosService {
  constructor(private readonly repo: SupermercadosRepositorio) {}

  /**
   * Supermercados activos con su preferencia. Un hogar que todavía no decidió tiene todos como
   * preferidos; si ya decidió, uno que apareció después no lo es hasta que se marque.
   */
  async supermercados(hogarId: string): Promise<SupermercadoPreferido[]> {
    const filas = await this.repo.supermercados(hogarId);
    const decidido = filas.some((f) => f.preferido !== null);
    return filas.map((f) => ({
      supermercadoId: f.id,
      nombre: f.nombre,
      preferido: decidido ? f.preferido === true : true,
    }));
  }

  /** E1: al menos uno preferido. Un id que no es un supermercado activo es 404. */
  async guardarSupermercados(
    hogarId: string,
    dto: GuardarSupermercadosDto,
  ): Promise<SupermercadoPreferido[]> {
    const preferidos = new Set(dto.preferidos);
    if (preferidos.size === 0) {
      throw new Problema(
        422,
        'SIN_SUPERMERCADO_PREFERIDO',
        'Debes tener al menos un supermercado preferido',
      );
    }
    const filas = await this.repo.supermercados(hogarId);
    const conocidos = new Set(filas.map((f) => f.id));
    if ([...preferidos].some((id) => !conocidos.has(id))) {
      throw new Problema(404, 'NO_ENCONTRADO', 'El supermercado no existe.');
    }
    await this.repo.guardarSupermercados(
      hogarId,
      filas.map((f) => ({ id: f.id, preferido: preferidos.has(f.id) })),
    );
    return this.supermercados(hogarId);
  }

  marcasElegidas(hogarId: string): Promise<MarcaElegida[]> {
    return this.repo.marcasElegidas(hogarId);
  }

  /** Marcas vinculadas del producto con presentaciones y último precio (pasos 3 a 5, 4a). */
  async marcasDeProducto(hogarId: string, productoId: string): Promise<VistaMarcasProducto> {
    const producto = await this.productoExistente(productoId);
    const [vinculos, marcaPreferida] = await Promise.all([
      this.repo.vinculos(productoId),
      this.repo.marcaDe(hogarId, productoId),
    ]);
    const precios = await this.repo.precios(
      hogarId,
      vinculos.map((v) => v.id),
    );
    return {
      productoId: producto.id,
      producto: producto.nombre,
      marcaPreferida,
      marcas: this.agrupar(vinculos, precios),
    };
  }

  /**
   * Fija (o quita con `null`) la marca preferida. La marca tiene que estar vinculada al producto
   * (RF-35), si no es 422 `MARCA_SIN_VINCULO`.
   */
  async guardarMarca(
    hogarId: string,
    productoId: string,
    dto: GuardarMarcaDto,
  ): Promise<VistaMarcasProducto> {
    await this.productoExistente(productoId);
    const pedida = dto.marca?.trim() ?? '';
    if (pedida === '') {
      await this.repo.guardarMarca(hogarId, productoId, null);
    } else {
      const normalizada = normalizarNombreCatalogo(pedida);
      const vinculo = (await this.repo.vinculos(productoId)).find(
        (v) => v.marcaNormalizada === normalizada,
      );
      if (!vinculo?.marca) {
        throw new Problema(
          422,
          'MARCA_SIN_VINCULO',
          `La marca "${pedida}" no está vinculada a este producto.`,
        );
      }
      await this.repo.guardarMarca(hogarId, productoId, {
        marca: vinculo.marca,
        marcaNormalizada: normalizada,
      });
    }
    return this.marcasDeProducto(hogarId, productoId);
  }

  private async productoExistente(productoId: string): Promise<{ id: string; nombre: string }> {
    const producto = await this.repo.producto(productoId);
    if (!producto) throw new Problema(404, 'NO_ENCONTRADO', 'El producto no existe.');
    return producto;
  }

  private agrupar(vinculos: FilaVinculo[], precios: FilaPrecio[]): OpcionMarca[] {
    const ultimo = new Map<string, FilaPrecio>();
    for (const p of precios) {
      if (!ultimo.has(p.productoSupermercadoId)) ultimo.set(p.productoSupermercadoId, p);
    }
    const porMarca = new Map<string, OpcionMarca>();
    for (const v of vinculos) {
      if (!v.marca || !v.marcaNormalizada) continue;
      const opcion = porMarca.get(v.marcaNormalizada) ?? { marca: v.marca, presentaciones: [] };
      const p = ultimo.get(v.id);
      opcion.presentaciones.push({
        supermercado: v.supermercado,
        presentacion: `${sinCeros(v.presentacionCantidad)} ${v.unidad}`,
        ultimoPrecio: p ? { precio: p.precio, fecha: p.fechaPrecio } : null,
      });
      porMarca.set(v.marcaNormalizada, opcion);
    }
    return [...porMarca.values()].sort((a, b) => a.marca.localeCompare(b.marca, 'es'));
  }
}
