import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import type { OperacionLista } from '@menu/shared';

const OPERACIONES: OperacionLista[] = [
  'AGREGAR',
  'ACTUALIZAR',
  'MARCAR_COMPRADO',
  'MARCAR_YA_LO_TENGO',
  'DESMARCAR_COMPRADO',
  'REGISTRAR_PRECIO',
  'ELIMINAR',
];

/**
 * Datos de un cambio. La cantidad y el texto los valida `resolverCambio` por cambio, para que uno
 * inválido se rechace solo y no tire el resto del lote (CU-07.3 E1 y E2).
 */
export class DatosCambioListaDto {
  @IsOptional()
  @IsUUID('4', { message: 'Producto no válido' })
  productoId?: string | null;

  @IsOptional()
  textoLibre?: string | null;

  @IsOptional()
  cantidadComprar?: number | string | null;

  /** Total pagado por el ítem (CU-07.7); lo valida `resolverCambio` por cambio. */
  @IsOptional()
  precioReal?: number | string | null;

  /** Contenido comprado en la unidad de la presentación del catálogo (CU-07.7 2b). */
  @IsOptional()
  contenidoComprado?: number | string | null;
}

export class CambioListaDto {
  @IsUUID('4', { message: 'El cambio necesita un identificador' })
  id!: string;

  @IsUUID('4', { message: 'El producto de la lista no es válido' })
  itemId!: string;

  @IsIn(OPERACIONES, { message: 'Operación no válida' })
  operacion!: OperacionLista;

  @IsOptional()
  @ValidateNested()
  @Type(() => DatosCambioListaDto)
  datos?: DatosCambioListaDto | null;

  @IsISO8601({ strict: true }, { message: 'La marca de tiempo no es válida' })
  marcaTiempo!: string;
}

/** POST /listas/{id}/sync (api-contrato §2.7). */
export class SincronizarListaDto {
  /** Versión de la lista que el dispositivo tenía; informativa, la lista vigente siempre se devuelve. */
  @IsOptional()
  @IsInt({ message: 'versionBase debe ser un entero' })
  @Min(0)
  versionBase?: number;

  @IsArray({ message: 'cambios debe ser una lista' })
  @ValidateNested({ each: true })
  @Type(() => CambioListaDto)
  cambios!: CambioListaDto[];
}
