/**
 * DTO del precio manual (api-contrato §2.8). Valida tipos y forma (400 `VALIDACION`); las reglas
 * de negocio con código propio (422 `PRECIO_INVALIDO`, `FECHA_FUTURA`…) las aplica el servicio.
 */
import { Allow, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * POST /precios (CU-08.1 manual): el precio va sobre un vínculo existente
 * (`productoSupermercadoId`) o sobre el par producto + supermercado; si ese par no tiene vínculo
 * activo, la presentación sirve para crear uno mínimo (flujo alterno 1a).
 */
export class CrearPrecioDto {
  @IsOptional()
  @IsUUID('4', { message: 'Vínculo no válido' })
  productoSupermercadoId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Elige un producto de la lista' })
  productoId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Elige un supermercado de la lista' })
  supermercadoId?: string;

  @IsOptional()
  @Allow()
  presentacionCantidad?: string | number;

  @IsOptional()
  @IsUUID('4', { message: 'Elige una unidad de la lista' })
  presentacionUnidadId?: string;

  /** Número o texto con punto decimal; el servicio lo valida con las reglas de CA-34.4. */
  @Allow()
  precio!: string | number;

  @IsString({ message: 'La fecha de compra debe ser texto aaaa-mm-dd' })
  fechaPrecio!: string;
}
