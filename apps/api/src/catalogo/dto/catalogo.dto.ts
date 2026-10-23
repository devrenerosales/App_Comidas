/**
 * DTOs del catálogo (api-contrato §2.3). Validan tipos y forma (400 `VALIDACION`); las reglas
 * de negocio con código propio (422 `SIN_TIEMPO`, `PRESENTACION_INVALIDA`, `UNIDAD_INCOMPATIBLE`…)
 * las aplica el servicio para poder señalar el ítem exacto con error.
 */
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  MAXIMO_INGREDIENTES,
  ORDEN_TIEMPOS,
  ProteinaPrincipal,
  TipoProducto,
  type TiempoComida,
} from '@menu/shared';
import { TAMANO_MAXIMO, TAMANO_POR_DEFECTO } from '../paginacion';

/** Un decimal llega como número o como texto (api-contrato §1.2); se guarda como texto. */
const decimalComoTexto = ({ value }: { value: unknown }) =>
  typeof value === 'number' && Number.isFinite(value) ? String(value) : value;
const DECIMAL = /^-?\d{1,10}(\.\d+)?$/;
const MENSAJE_DECIMAL = 'Ingresa un número (usa punto para los decimales)';

const vacioComoIndefinido = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/** `?pagina=1&tamano=20` (máx. 100). */
export class PaginacionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La página debe ser un número entero' })
  @Min(1, { message: 'La página debe ser 1 o mayor' })
  pagina: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El tamaño debe ser un número entero' })
  @Min(1, { message: 'El tamaño debe ser 1 o mayor' })
  @Max(TAMANO_MAXIMO, { message: `El tamaño máximo es ${TAMANO_MAXIMO}` })
  tamano: number = TAMANO_POR_DEFECTO;
}

// -----------------------------------------------------------------------------
// Productos (HU-13)
// -----------------------------------------------------------------------------

/** GET /productos?q&tipo&categoria&activo&pagina&tamano */
export class ConsultaProductosDto extends PaginacionDto {
  @IsOptional()
  @Transform(vacioComoIndefinido)
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @Transform(vacioComoIndefinido)
  @IsIn(Object.values(TipoProducto), { message: 'Tipo de producto no válido' })
  tipo?: TipoProducto;

  /** Código de la categoría (carnes, lacteos, granos…). */
  @IsOptional()
  @Transform(vacioComoIndefinido)
  @IsString()
  @MaxLength(20)
  categoria?: string;

  /** `true` (por defecto, el buscador de ingredientes), `false` o `todos`. */
  @IsOptional()
  @IsIn(['true', 'false', 'todos'], { message: 'activo debe ser true, false o todos' })
  activo: 'true' | 'false' | 'todos' = 'true';
}

/** POST /productos */
export class CrearProductoDto {
  @IsString({ message: 'Ingresa el nombre del producto' })
  nombre!: string;

  @IsIn(Object.values(TipoProducto), { message: 'Elige ingrediente, despensa o ambos' })
  tipo!: TipoProducto;

  @IsUUID('4', { message: 'Elige una categoría' })
  categoriaId!: string;

  @IsString({ message: 'Indica cómo se compra (bolsa, lb, unidad, frasco…)' })
  unidadCompra!: string;

  @Transform(decimalComoTexto)
  @IsString({ message: MENSAJE_DECIMAL })
  @Matches(DECIMAL, { message: MENSAJE_DECIMAL })
  presentacionCantidad!: string;

  @IsUUID('4', { message: 'Elige la unidad de la presentación' })
  presentacionUnidadId!: string;
}

/** PATCH /productos/{id} (administrador del sistema). */
export class ActualizarProductoDto {
  @IsOptional()
  @IsString({ message: 'Ingresa el nombre del producto' })
  nombre?: string;

  @IsOptional()
  @IsIn(Object.values(TipoProducto), { message: 'Elige ingrediente, despensa o ambos' })
  tipo?: TipoProducto;

  @IsOptional()
  @IsUUID('4', { message: 'Elige una categoría' })
  categoriaId?: string;

  @IsOptional()
  @IsString({ message: 'Indica cómo se compra (bolsa, lb, unidad, frasco…)' })
  unidadCompra?: string;

  @IsOptional()
  @Transform(decimalComoTexto)
  @IsString({ message: MENSAJE_DECIMAL })
  @Matches(DECIMAL, { message: MENSAJE_DECIMAL })
  presentacionCantidad?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Elige la unidad de la presentación' })
  presentacionUnidadId?: string;
}

// -----------------------------------------------------------------------------
// Platillos (HU-11)
// -----------------------------------------------------------------------------

export const ESTADOS_PLATILLO = ['ACTIVO', 'INACTIVO', 'INCOMPLETO'] as const;
export type EstadoPlatillo = (typeof ESTADOS_PLATILLO)[number];

/** GET /platillos?q&tiempo&proteina&etiqueta&ingrediente&estado&pagina&tamano */
export class ConsultaPlatillosDto extends PaginacionDto {
  @IsOptional()
  @Transform(vacioComoIndefinido)
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @Transform(vacioComoIndefinido)
  @IsIn(ORDEN_TIEMPOS, { message: 'Tiempo de comida no válido' })
  tiempo?: TiempoComida;

  @IsOptional()
  @Transform(vacioComoIndefinido)
  @IsIn(Object.values(ProteinaPrincipal), { message: 'Proteína principal no válida' })
  proteina?: ProteinaPrincipal;

  @IsOptional()
  @Transform(vacioComoIndefinido)
  @IsString()
  @MaxLength(30)
  etiqueta?: string;

  /** Id de un producto: platillos que lo usan como ingrediente. */
  @IsOptional()
  @Transform(vacioComoIndefinido)
  @IsUUID('4', { message: 'Ingrediente no válido' })
  ingrediente?: string;

  @IsOptional()
  @IsIn(ESTADOS_PLATILLO, { message: 'estado debe ser ACTIVO, INACTIVO o INCOMPLETO' })
  estado: EstadoPlatillo = 'ACTIVO';
}

/**
 * POST /platillos y PATCH /platillos/{id}. En POST el servicio exige nombre y al menos un
 * tiempo (CU-03.1 E1, E2); en PATCH todos son opcionales.
 */
export class DatosPlatilloDto {
  @IsOptional()
  @IsString({ message: 'Ingresa el nombre del platillo' })
  nombre?: string;

  @IsOptional()
  @IsArray({ message: 'Selecciona al menos un tiempo de comida' })
  @ArrayMaxSize(3)
  @IsIn(ORDEN_TIEMPOS, { each: true, message: 'Tiempo de comida no válido' })
  tiempos?: TiempoComida[];

  @IsOptional()
  @IsIn(Object.values(ProteinaPrincipal), { message: 'Elige la proteína principal de la lista' })
  proteinaPrincipal?: ProteinaPrincipal;

  @IsOptional()
  @IsArray({ message: 'Las etiquetas deben ser una lista' })
  @ArrayMaxSize(50)
  @IsString({ each: true, message: 'Cada etiqueta debe ser texto' })
  etiquetas?: string[];

  @IsOptional()
  @IsBoolean()
  favorito?: boolean;
}

/** Ingrediente para las porciones base (RF-12). */
export class IngredienteDto {
  @IsUUID('4', { message: 'Elige un producto del catálogo' })
  productoId!: string;

  @Transform(decimalComoTexto)
  @IsString({ message: MENSAJE_DECIMAL })
  @Matches(DECIMAL, { message: MENSAJE_DECIMAL })
  cantidad!: string;

  @IsUUID('4', { message: 'Elige la unidad' })
  unidadId!: string;
}

/** PUT /platillos/{id}/ingredientes */
export class IngredientesDto {
  @Type(() => Number)
  @IsNumber({}, { message: 'Indica las porciones base' })
  porcionesBase!: number;

  @IsArray({ message: 'Los ingredientes deben ser una lista' })
  @ArrayMaxSize(MAXIMO_INGREDIENTES, {
    message: `Un platillo admite hasta ${MAXIMO_INGREDIENTES} ingredientes`,
  })
  @ValidateNested({ each: true })
  @Type(() => IngredienteDto)
  ingredientes!: IngredienteDto[];
}

/** GET /platillos/{id}/vista-previa?sumaFactores=2.5 */
export class ConsultaVistaPreviaDto {
  @IsOptional()
  @Transform(vacioComoIndefinido)
  @Type(() => Number)
  @IsNumber({}, { message: 'sumaFactores debe ser un número' })
  @Min(0.25, { message: 'sumaFactores debe ser al menos 0.25' })
  @Max(200, { message: 'sumaFactores admite hasta 200' })
  sumaFactores?: number;
}
