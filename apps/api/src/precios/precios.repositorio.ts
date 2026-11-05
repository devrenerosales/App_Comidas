import { Inject, Injectable } from '@nestjs/common';
import { precio, type Db } from '@menu/db';
import { DB } from '../database/database.constants';

export interface DatosPrecioManual {
  productoSupermercadoId: string;
  hogarId: string;
  registradoPorId: string;
  /** Precio de la presentación en tienda, con dos decimales. */
  precio: string;
  /** Precio llevado a la presentación de compra del catálogo. */
  precioNormalizado: string;
  fechaPrecio: string;
}

/** Escritura de precios manuales: pertenecen al hogar que los registra (D-05, RNF-06). */
@Injectable()
export class PreciosRepositorio {
  constructor(@Inject(DB) private readonly db: Db) {}

  async insertarManual(datos: DatosPrecioManual): Promise<{ id: string }> {
    const [fila] = await this.db
      .insert(precio)
      .values({ ...datos, origen: 'MANUAL' })
      .returning({ id: precio.id });
    return fila!;
  }
}
