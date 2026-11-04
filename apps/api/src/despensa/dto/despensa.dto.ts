import { Allow, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { FRECUENCIAS_DESPENSA, MENSAJES_DESPENSA, type FrecuenciaDespensa } from '@menu/shared';

/** Largo máximo de la nota de un producto de despensa (modelo de datos). */
export const NOTAS_DESPENSA_MAXIMO = 200;

const FRECUENCIA_INVALIDA = {
  message: MENSAJES_DESPENSA.frecuencia,
  context: { status: 422, codigo: 'FRECUENCIA_INVALIDA' },
};

/**
 * POST /despensa (CU-07.2). La cantidad se valida en el servicio con `cantidadValida` para
 * responder 422 `CANTIDAD_INVALIDA` con el mensaje de CA-29.4, venga como texto o como número.
 */
export class CrearDespensaDto {
  @IsUUID('4', {
    message: 'Elige un producto del catálogo',
    context: { status: 422, codigo: 'PRODUCTO_INVALIDO' },
  })
  productoId!: string;

  @Allow()
  cantidad?: unknown;

  @IsIn(FRECUENCIAS_DESPENSA, FRECUENCIA_INVALIDA)
  frecuencia!: FrecuenciaDespensa;

  @IsOptional()
  @IsString({ message: 'La nota no es válida' })
  @MaxLength(NOTAS_DESPENSA_MAXIMO, {
    message: `La nota admite hasta ${NOTAS_DESPENSA_MAXIMO} caracteres`,
  })
  notas?: string;
}

/** PATCH /despensa/{id}: solo cambia lo que llega. */
export class ActualizarDespensaDto {
  @IsOptional()
  @Allow()
  cantidad?: unknown;

  @IsOptional()
  @IsIn(FRECUENCIAS_DESPENSA, FRECUENCIA_INVALIDA)
  frecuencia?: FrecuenciaDespensa;

  @IsOptional()
  @IsString({ message: 'La nota no es válida' })
  @MaxLength(NOTAS_DESPENSA_MAXIMO, {
    message: `La nota admite hasta ${NOTAS_DESPENSA_MAXIMO} caracteres`,
  })
  notas?: string;
}
