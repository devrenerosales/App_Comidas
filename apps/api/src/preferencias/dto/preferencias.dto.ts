import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';

/** Tope razonable por lista; el hogar no necesita más de esto (RNF de tamaño de cuerpo). */
export const MAXIMO_GUSTOS = 200;

/** PUT /hogar/preferencias/gustos (y su vista previa): reemplaza ambas listas completas. */
export class GuardarGustosDto {
  @IsArray({ message: 'Los ingredientes excluidos deben ser una lista' })
  @ArrayMaxSize(MAXIMO_GUSTOS, { message: `Hasta ${MAXIMO_GUSTOS} ingredientes excluidos` })
  @IsUUID('4', { each: true, message: 'Ingrediente no válido' })
  ingredientesExcluidos!: string[];

  @IsArray({ message: 'Los favoritos deben ser una lista' })
  @ArrayMaxSize(MAXIMO_GUSTOS, { message: `Hasta ${MAXIMO_GUSTOS} platillos favoritos` })
  @IsUUID('4', { each: true, message: 'Platillo no válido' })
  favoritos!: string[];
}
