import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ModoDistribucion, ORDEN_TIEMPOS, type TiempoComida } from '@menu/shared';
import { DIAS_SEMANA, type DiaSemana } from '../semanas';

/**
 * Los decimales viajan como texto (api-contrato §1.2); por comodidad se acepta también un número,
 * que se pasa a texto. El formato (2 decimales, rango) lo valida el servicio con @menu/shared
 * para responder 422 con el código de negocio.
 */
const aTexto = ({ value }: { value: unknown }) =>
  typeof value === 'number' ? String(value) : value;

const MENSAJE_TIEMPO = 'Elige DESAYUNO, ALMUERZO o CENA';
const MENSAJE_VERSION = 'Indica la versión de la configuración que estás editando';

export class GuardarSemanaDto {
  @IsInt({ message: MENSAJE_VERSION })
  @Min(1, { message: MENSAJE_VERSION })
  version!: number;

  @IsIn(DIAS_SEMANA, {
    message: 'Elige un día de inicio válido',
    context: { status: 422, codigo: 'DIA_SEMANA_INVALIDO' },
  })
  diaInicioSemana!: DiaSemana;

  @IsIn(DIAS_SEMANA, {
    message: 'Elige un día de planificación válido',
    context: { status: 422, codigo: 'DIA_SEMANA_INVALIDO' },
  })
  diaPlanificacion!: DiaSemana;
}

/** `{ tiempo, porcentaje }` de un tiempo activo. */
export class TiempoPorcentajeDto {
  @IsIn(ORDEN_TIEMPOS, { message: MENSAJE_TIEMPO })
  tiempo!: TiempoComida;

  @Transform(aTexto)
  @IsString({ message: 'Indica el porcentaje como texto decimal, p. ej. "60.00"' })
  porcentaje!: string;
}

/** `{ tiempo, porcentaje? , monto? }` de PUT /presupuesto (según el modo). */
export class RepartoTiempoDto {
  @IsIn(ORDEN_TIEMPOS, { message: MENSAJE_TIEMPO })
  tiempo!: TiempoComida;

  @IsOptional()
  @Transform(aTexto)
  @IsString({ message: 'Indica el porcentaje como texto decimal, p. ej. "60.00"' })
  porcentaje?: string;

  @IsOptional()
  @Transform(aTexto)
  @IsString({ message: 'Indica el monto como texto decimal, p. ej. "300.00"' })
  monto?: string;
}

/** POST /hogar/configuracion/vista-previa (HU-07). */
export class VistaPreviaDto {
  @IsArray({ message: 'Indica los tiempos de comida' })
  @ArrayMinSize(1, { message: 'Indica al menos un tiempo de comida' })
  @ArrayMaxSize(3, { message: 'Hay como máximo tres tiempos de comida' })
  @ArrayUnique({ message: 'No repitas tiempos de comida' })
  @IsIn(ORDEN_TIEMPOS, { each: true, message: MENSAJE_TIEMPO })
  tiempos!: TiempoComida[];

  /** Presupuesto que se está editando; si falta se usa el vigente. */
  @IsOptional()
  @Transform(aTexto)
  @IsString({ message: 'Indica el presupuesto como texto decimal, p. ej. "500.00"' })
  presupuestoSemanal?: string;

  /** Ajuste de los porcentajes propuestos (CU-02.3 paso 4); si falta se usa RN-06. */
  @IsOptional()
  @IsArray({ message: 'Indica la distribución como lista' })
  @ArrayMaxSize(3, { message: 'Hay como máximo tres tiempos de comida' })
  @ValidateNested({ each: true })
  @Type(() => TiempoPorcentajeDto)
  distribucion?: TiempoPorcentajeDto[];
}

/** PUT /hogar/configuracion/tiempos (HU-05, HU-07): tiempos activos con su porcentaje. */
export class GuardarTiemposDto {
  @IsInt({ message: MENSAJE_VERSION })
  @Min(1, { message: MENSAJE_VERSION })
  version!: number;

  @IsArray({ message: 'Indica los tiempos de comida' })
  @ArrayMinSize(1, { message: 'Indica al menos un tiempo de comida' })
  @ArrayMaxSize(3, { message: 'Hay como máximo tres tiempos de comida' })
  @ValidateNested({ each: true })
  @Type(() => TiempoPorcentajeDto)
  tiempos!: TiempoPorcentajeDto[];

  /** Opcional: guarda también el presupuesto en la misma transacción. */
  @IsOptional()
  @Transform(aTexto)
  @IsString({ message: 'Indica el presupuesto como texto decimal, p. ej. "500.00"' })
  presupuestoSemanal?: string;
}

/** PUT /hogar/configuracion/presupuesto (HU-06). */
/** PUT /pesos-motor (HU-20): los cuatro pesos como texto decimal, p. ej. "0.40". */
export class GuardarPesosMotorDto {
  @IsInt({ message: MENSAJE_VERSION })
  @Min(1, { message: MENSAJE_VERSION })
  version!: number;

  @Transform(aTexto)
  @IsString({ message: 'Indica el peso de Preferencia como texto decimal, p. ej. "0.40"' })
  preferencia!: string;

  @Transform(aTexto)
  @IsString({ message: 'Indica el peso de Novedad como texto decimal, p. ej. "0.25"' })
  novedad!: string;

  @Transform(aTexto)
  @IsString({ message: 'Indica el peso de Ahorro como texto decimal, p. ej. "0.20"' })
  ahorro!: string;

  @Transform(aTexto)
  @IsString({ message: 'Indica el peso de Afinidad como texto decimal, p. ej. "0.15"' })
  afinidad!: string;
}

export class GuardarPresupuestoDto {
  @IsInt({ message: MENSAJE_VERSION })
  @Min(1, { message: MENSAJE_VERSION })
  version!: number;

  @Transform(aTexto)
  @IsString({ message: 'Indica el presupuesto como texto decimal, p. ej. "500.00"' })
  presupuestoSemanal!: string;

  @IsOptional()
  @IsIn(Object.values(ModoDistribucion), { message: 'Elige el modo PORCENTAJE o MONTO' })
  modo?: ModoDistribucion;

  /** Si falta, se conservan los porcentajes vigentes y se recalculan los montos. */
  @IsOptional()
  @IsArray({ message: 'Indica la distribución como lista' })
  @ArrayMaxSize(3, { message: 'Hay como máximo tres tiempos de comida' })
  @ValidateNested({ each: true })
  @Type(() => RepartoTiempoDto)
  distribucion?: RepartoTiempoDto[];
}
