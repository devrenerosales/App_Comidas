import {
  Allow,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { NOTA_GASTO_MAXIMA } from '@menu/shared';

/** POST /menus/generar. El calendario real de la semana lo valida el servicio (422). */
export class GenerarMenuDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Elige la semana (AAAA-MM-DD)' })
  semana!: string;

  @IsOptional()
  @IsBoolean({ message: 'regenerar debe ser verdadero o falso' })
  regenerar?: boolean;
}

/** PATCH /menus/{id}/detalles/{detalleId}: elige otro platillo para el espacio (CU-06.1 2a). */
export class EditarDetalleDto {
  @IsUUID('4', { message: 'Elige un platillo del catálogo' })
  platilloId!: string;

  @IsOptional()
  @IsBoolean({ message: 'confirmar debe ser verdadero o falso' })
  confirmar?: boolean;
}

/** POST /menus/{id}/mover: mueve o intercambia dos espacios (CU-06.1 2b). */
export class MoverDetalleDto {
  @IsUUID('4', { message: 'Origen no válido' })
  origenDetalleId!: string;

  @IsUUID('4', { message: 'Destino no válido' })
  destinoDetalleId!: string;

  @IsOptional()
  @IsBoolean({ message: 'confirmar debe ser verdadero o falso' })
  confirmar?: boolean;
}

/** PUT /menus/{id}/detalles/{detalleId}/fijado (CU-06.1 2c). */
export class FijarDetalleDto {
  @IsBoolean({ message: 'fijado debe ser verdadero o falso' })
  fijado!: boolean;
}

/** POST /menus/{id}/aprobar: la versión del menú que el usuario vio (CU-06.2, api-contrato §3.2). */
export class AprobarMenuDto {
  @IsInt({ message: 'La versión del menú no es válida' })
  @Min(1, { message: 'La versión del menú no es válida' })
  version!: number;
}

/**
 * PUT /menus/{id}/gasto-real (CU-06.4). El monto se valida en el servicio para responder con el
 * mensaje de CA-27.3 (422 MONTO_INVALIDO) y no con el formato genérico de los DTO.
 */
export class RegistrarGastoDto {
  @Allow()
  monto?: unknown;

  @IsOptional()
  @IsString({ message: 'La nota no es válida' })
  @MaxLength(NOTA_GASTO_MAXIMA, { message: `La nota admite hasta ${NOTA_GASTO_MAXIMA} caracteres` })
  nota?: string;
}
