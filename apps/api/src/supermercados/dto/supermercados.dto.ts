import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/** PUT /hogar/preferencias/supermercados: la lista completa de preferidos (reemplaza). */
export class GuardarSupermercadosDto {
  @IsArray({ message: 'Los supermercados preferidos deben ser una lista' })
  @ArrayMaxSize(20, { message: 'Hay demasiados supermercados' })
  @IsUUID('4', { each: true, message: 'Supermercado no válido' })
  preferidos!: string[];
}

/** PUT /hogar/preferencias/marcas/{productoId}: `marca: null` = cualquier marca. */
export class GuardarMarcaDto {
  @IsOptional()
  @IsString({ message: 'La marca debe ser texto' })
  @MaxLength(60, { message: 'La marca admite hasta 60 caracteres' })
  marca?: string | null;
}
