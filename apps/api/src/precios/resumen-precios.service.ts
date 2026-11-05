import { Inject, Injectable } from '@nestjs/common';
import { resumenPrecios, type PrecioDeSupermercado, type ResumenPrecios } from '@menu/shared';
import { Problema } from '../comun/problema';
import { fechaLocal } from '../configuracion/semanas';
import { VinculosRepositorio } from '../vinculos/vinculos.repositorio';
import { RELOJ_PRECIOS } from './precios.constants';
import {
  ResumenPreciosRepositorio,
  type FilaPrecioDeProducto,
} from './resumen-precios.repositorio';

/** Resumen de precios de un producto para el hogar (GET /productos/{id}/resumen-precio). */
export interface VistaResumenPrecio {
  productoId: string;
  /** Costo estimado del menú (RN-01): mediana de todos los supermercados que cuentan. */
  precioMediana: string;
  /** Compra sugerida (CU-07.4): el más barato entre los supermercados preferidos. */
  precioMinimo: string;
  supermercadoMinimo: { id: string; nombre: string };
  fechaPrecioMinimo: string;
  cantidadPrecios: number;
  /** Ningún precio vigente (≤ 14 días): se usaron los últimos conocidos (RN-08). */
  desactualizado: boolean;
  fechaPrecioMasAntiguo: string;
  calculadoEn: string;
}

const aPrecios = (filas: FilaPrecioDeProducto[]): PrecioDeSupermercado[] =>
  filas.map((f) => ({
    supermercadoId: f.supermercadoId,
    supermercado: f.supermercado,
    precio: f.precio,
    fecha: f.fecha,
  }));

/**
 * M08 · CU-09.2 — mantiene `precio_resumen` por producto y hogar (HU-36). Es lo que leen el costo
 * del menú (mediana) y la lista de compras (mínimo). Se recalcula cuando el hogar registra un
 * precio, cambia sus supermercados preferidos o genera un menú, porque la vigencia de 14 días
 * depende de la fecha de hoy; el worker de precios (HU-33) lo hará tras cada corrida.
 */
@Injectable()
export class ResumenPreciosService {
  constructor(
    private readonly repo: ResumenPreciosRepositorio,
    private readonly productos: VinculosRepositorio,
    @Inject(RELOJ_PRECIOS) private readonly reloj: () => Date,
  ) {}

  /** Recalcula y guarda el resumen de un producto; sin precios borra el que hubiera (E1). */
  async recalcularProducto(hogarId: string, productoId: string): Promise<ResumenPrecios | null> {
    const [filas, preferidos] = await Promise.all([
      this.repo.precios(hogarId, productoId),
      this.repo.preferidos(hogarId),
    ]);
    const ahora = this.reloj();
    const resumen = resumenPrecios(aPrecios(filas), fechaLocal(ahora), preferidos);
    if (resumen) await this.repo.guardar(hogarId, productoId, resumen, ahora);
    else await this.repo.eliminar(hogarId, productoId);
    return resumen;
  }

  /** Recalcula todos los productos del hogar con una sola lectura de precios. */
  async recalcularHogar(hogarId: string): Promise<void> {
    const [filas, preferidos, guardados] = await Promise.all([
      this.repo.precios(hogarId),
      this.repo.preferidos(hogarId),
      this.repo.productosConResumen(hogarId),
    ]);
    const porProducto = new Map<string, FilaPrecioDeProducto[]>();
    for (const f of filas) {
      const lista = porProducto.get(f.productoId) ?? [];
      lista.push(f);
      porProducto.set(f.productoId, lista);
    }
    const ahora = this.reloj();
    const hoy = fechaLocal(ahora);
    const conResumen = new Set<string>();
    for (const [productoId, lista] of porProducto) {
      const resumen = resumenPrecios(aPrecios(lista), hoy, preferidos);
      if (!resumen) continue;
      conResumen.add(productoId);
      await this.repo.guardar(hogarId, productoId, resumen, ahora);
    }
    await this.repo.eliminarVarios(
      hogarId,
      guardados.filter((id) => !conResumen.has(id)),
    );
  }

  /** El resumen al día; 404 `SIN_PRECIO` si el producto no tiene ningún precio (E1). */
  async obtener(hogarId: string, productoId: string): Promise<VistaResumenPrecio> {
    if (!(await this.productos.producto(productoId))) {
      throw new Problema(404, 'NO_ENCONTRADO', 'El producto no existe.');
    }
    const resumen = await this.recalcularProducto(hogarId, productoId);
    if (!resumen) throw new Problema(404, 'SIN_PRECIO', 'Sin precio');
    return {
      productoId,
      precioMediana: resumen.precioMediana,
      precioMinimo: resumen.precioMinimo,
      supermercadoMinimo: { id: resumen.supermercadoMinimoId, nombre: resumen.supermercadoMinimo },
      fechaPrecioMinimo: resumen.fechaPrecioMinimo,
      cantidadPrecios: resumen.cantidadPrecios,
      desactualizado: resumen.desactualizado,
      fechaPrecioMasAntiguo: resumen.fechaPrecioMasAntiguo,
      calculadoEn: this.reloj().toISOString(),
    };
  }
}
