import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
export class ArchivoDto {
  @IsOptional() @IsIn(['ARCHIVO', 'CUADERNO']) origen: 'ARCHIVO' | 'CUADERNO' = 'ARCHIVO';
}
export class PlantillaDto {
  @IsIn(['csv', 'xlsx']) formato: 'csv' | 'xlsx' = 'xlsx';
  @IsOptional() @IsIn(['menus', 'listas', 'cuaderno']) hoja: 'menus' | 'listas' | 'cuaderno' =
    'menus';
}
export class RevisionDto {
  @IsUUID('4') revision!: string;
}
export class DecisionSemanaDto {
  @IsString() semanaInicio!: string;
  @IsIn(['OMITIR', 'REEMPLAZAR']) decision!: 'OMITIR' | 'REEMPLAZAR';
}
export class DecisionesDto extends RevisionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => DecisionSemanaDto)
  decisiones!: DecisionSemanaDto[];
}
export class DecisionPlatilloDto {
  @IsString() @MaxLength(80) nombreNormalizado!: string;
  @IsIn(['ASOCIAR', 'CREAR']) decision!: 'ASOCIAR' | 'CREAR';
  @IsOptional() @IsUUID('4') platilloId?: string;
  @IsOptional() @IsString() @MaxLength(80) nombreFinal?: string;
}
export class DecisionesPlatillosDto extends RevisionDto {
  @IsOptional() @IsBoolean() aceptarPropuestas?: boolean;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => DecisionPlatilloDto)
  decisiones?: DecisionPlatilloDto[];
}
export class PlatillosConsultaDto {
  @IsOptional() @IsIn(['pendientes', 'revisar', 'todos']) estado:
    | 'pendientes'
    | 'revisar'
    | 'todos' = 'pendientes';
  @Type(() => Number) @IsInt() @Min(1) pagina: number = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) tamano: number = 50;
}
export class FilasDto {
  @IsOptional() @IsIn(['true', 'false']) soloErrores?: string;
  @IsOptional() @IsIn(['MENUS', 'LISTAS']) hoja: 'MENUS' | 'LISTAS' = 'MENUS';
  @Type(() => Number) @IsInt() @Min(1) pagina: number = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) tamano: number = 50;
}
