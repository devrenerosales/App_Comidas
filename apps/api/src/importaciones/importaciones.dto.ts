import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
export class ArchivoDto {
  @IsOptional() @IsIn(['ARCHIVO']) origen: string = 'ARCHIVO';
}
export class PlantillaDto {
  @IsIn(['csv', 'xlsx']) formato: 'csv' | 'xlsx' = 'xlsx';
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
export class FilasDto {
  @IsOptional() @IsIn(['true', 'false']) soloErrores?: string;
  @Type(() => Number) @IsInt() @Min(1) pagina: number = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) tamano: number = 50;
}
