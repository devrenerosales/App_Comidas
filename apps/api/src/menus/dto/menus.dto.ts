import { IsBoolean, IsOptional, Matches } from 'class-validator';

/** POST /menus/generar. El calendario real de la semana lo valida el servicio (422). */
export class GenerarMenuDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Elige la semana (AAAA-MM-DD)' })
  semana!: string;

  @IsOptional()
  @IsBoolean({ message: 'regenerar debe ser verdadero o falso' })
  regenerar?: boolean;
}
