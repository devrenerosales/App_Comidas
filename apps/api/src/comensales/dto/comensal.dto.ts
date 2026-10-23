import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateBy,
  type ValidationOptions,
} from 'class-validator';
import {
  LARGO_MAXIMO_NOMBRE_COMENSAL,
  MENSAJES_COMENSALES,
  TipoComensal,
  esFactorPorcionValido,
  limpiarNombreComensal,
} from '@menu/shared';
import type { ContextoValidacion } from '../../comun/validacion';

const NOMBRE_INVALIDO: ContextoValidacion = { codigo: 'NOMBRE_COMENSAL_INVALIDO', status: 422 };
const FACTOR_INVALIDO: ContextoValidacion = { codigo: 'FACTOR_INVALIDO', status: 422 };

const limpiar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? limpiarNombreComensal(value) : value;

/** Factor de porción: número o texto decimal entre 0.25 y 2.0 en pasos de 0.25 (D-02). */
export function EsFactorPorcion(opciones?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    { name: 'esFactorPorcion', validator: { validate: (valor) => esFactorPorcionValido(valor) } },
    opciones,
  );
}

const MENSAJE_NOMBRE = { message: MENSAJES_COMENSALES.nombreObligatorio, context: NOMBRE_INVALIDO };
const MENSAJE_LARGO = { message: MENSAJES_COMENSALES.nombreLargo, context: NOMBRE_INVALIDO };
const MENSAJE_FACTOR = { message: MENSAJES_COMENSALES.factorInvalido, context: FACTOR_INVALIDO };
const MENSAJE_TIPO = { message: MENSAJES_COMENSALES.tipoInvalido };

/**
 * POST /hogar/comensales (ADMIN · RF-03 · HU-03). `tipo` es la etiqueta opcional adulto / niño
 * (ADULTO si se omite) y `factorPorcion` se sugiere en 1.0 (D-02).
 */
export class CrearComensalDto {
  @Transform(limpiar)
  @IsString(MENSAJE_NOMBRE)
  @IsNotEmpty(MENSAJE_NOMBRE)
  @MaxLength(LARGO_MAXIMO_NOMBRE_COMENSAL, MENSAJE_LARGO)
  nombre!: string;

  @IsOptional()
  @IsIn(Object.values(TipoComensal), MENSAJE_TIPO)
  tipo?: TipoComensal;

  @IsOptional()
  @EsFactorPorcion(MENSAJE_FACTOR)
  factorPorcion?: number | string;
}

/** PATCH /hogar/comensales/{id} (ADMIN): cambia nombre, etiqueta o factor (CU-01.3 2a). */
export class EditarComensalDto {
  @IsOptional()
  @Transform(limpiar)
  @IsString(MENSAJE_NOMBRE)
  @IsNotEmpty(MENSAJE_NOMBRE)
  @MaxLength(LARGO_MAXIMO_NOMBRE_COMENSAL, MENSAJE_LARGO)
  nombre?: string;

  @IsOptional()
  @IsIn(Object.values(TipoComensal), MENSAJE_TIPO)
  tipo?: TipoComensal;

  @IsOptional()
  @EsFactorPorcion(MENSAJE_FACTOR)
  factorPorcion?: number | string;
}
