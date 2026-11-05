/**
 * DTOs de vínculos (api-contrato §2.6). Validan tipos y forma (400 `VALIDACION`); las reglas de
 * negocio con código propio (422 `UNIDAD_NO_CONVERTIBLE`, `URL_FUERA_DE_DOMINIO`…) las aplica el
 * servicio.
 */
import { Allow, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/** POST /productos/{id}/vinculos (CU-08.2 paso 2). La cantidad llega como número o texto. */
export class CrearVinculoDto {
  @IsUUID('4', { message: 'Elige un supermercado de la lista' })
  supermercadoId!: string;

  @IsString({ message: 'El nombre en tienda debe ser texto' })
  @MaxLength(150, { message: 'El nombre en tienda admite hasta 150 caracteres' })
  nombreTienda!: string;

  @IsOptional()
  @IsString({ message: 'La marca debe ser texto' })
  @MaxLength(60, { message: 'La marca admite hasta 60 caracteres' })
  marca?: string | null;

  @Allow()
  presentacionCantidad!: string | number;

  @IsUUID('4', { message: 'Elige una unidad de la lista' })
  presentacionUnidadId!: string;

  @IsOptional()
  @IsString({ message: 'La URL debe ser texto' })
  @MaxLength(500, { message: 'La URL admite hasta 500 caracteres' })
  url?: string | null;

  @IsOptional()
  @IsString({ message: 'El SKU debe ser texto' })
  @MaxLength(60, { message: 'El SKU admite hasta 60 caracteres' })
  sku?: string | null;
}

/** PATCH /vinculos/{id}: la presentación no se edita (se reemplaza el vínculo). */
export class ActualizarVinculoDto {
  @IsOptional()
  @IsString({ message: 'El nombre en tienda debe ser texto' })
  @MaxLength(150, { message: 'El nombre en tienda admite hasta 150 caracteres' })
  nombreTienda?: string;

  @IsOptional()
  @IsString({ message: 'La marca debe ser texto' })
  @MaxLength(60, { message: 'La marca admite hasta 60 caracteres' })
  marca?: string | null;

  @IsOptional()
  @IsString({ message: 'La URL debe ser texto' })
  @MaxLength(500, { message: 'La URL admite hasta 500 caracteres' })
  url?: string | null;

  @IsOptional()
  @IsString({ message: 'El SKU debe ser texto' })
  @MaxLength(60, { message: 'El SKU admite hasta 60 caracteres' })
  sku?: string | null;
}
