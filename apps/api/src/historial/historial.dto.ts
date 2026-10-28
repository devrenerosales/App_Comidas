import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
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
import { ORDEN_TIEMPOS, type TiempoComida } from '@menu/shared';

export class ComidaHistoricaDto {
  @IsString() fecha!: string;
  @IsIn(ORDEN_TIEMPOS) tiempo!: TiempoComida;
  @IsUUID('4') platilloId!: string;
  @IsOptional() @IsString() @MaxLength(200) notas?: string;
}
export class CapturarSemanaDto {
  @IsString() fechaInicio!: string;
  @IsArray()
  @ArrayMaxSize(21)
  @ValidateNested({ each: true })
  @Type(() => ComidaHistoricaDto)
  detalles!: ComidaHistoricaDto[];
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'number' ? String(value) : value))
  @IsString()
  gastoReal?: string | null;
  @IsOptional() @IsString() @MaxLength(500) notas?: string;
  @IsOptional() @IsBoolean() reemplazar: boolean = false;
  @IsOptional() @IsInt() @Min(1) version?: number;
}
export class ConsultaHistorialDto {
  @IsOptional() @IsString() desde?: string;
  @IsOptional() @IsString() hasta?: string;
  @Type(() => Number) @IsInt() @Min(1) pagina: number = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) tamano: number = 20;
}
