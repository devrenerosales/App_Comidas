import { IsBoolean, IsOptional, IsUUID, Matches } from 'class-validator';

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
