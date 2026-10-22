import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum Entorno {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/** Variables de entorno requeridas por la API. Ver `.env.example`. */
export class VariablesEntorno {
  @IsEnum(Entorno)
  NODE_ENV: Entorno = Entorno.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  TZ: string = 'America/Guatemala';

  @IsString()
  @MinLength(1)
  DATABASE_URL!: string;

  @IsString()
  @MinLength(1)
  REDIS_URL!: string;

  @IsString()
  @MinLength(32)
  JWT_SECRET!: string;

  @IsString()
  @MinLength(32)
  JWT_REFRESH_SECRET!: string;

  /** Uno o varios orígenes separados por coma. */
  @IsString()
  CORS_ORIGIN: string = 'http://localhost:5173';

  @IsOptional()
  @IsString()
  VAPID_PUBLIC_KEY?: string;

  @IsOptional()
  @IsString()
  VAPID_PRIVATE_KEY?: string;

  @IsOptional()
  @IsString()
  VAPID_SUBJECT?: string;

  @IsOptional()
  @IsString()
  FCM_PROJECT_ID?: string;

  @IsOptional()
  @IsString()
  FCM_CLIENT_EMAIL?: string;

  @IsOptional()
  @IsString()
  FCM_PRIVATE_KEY?: string;
}

/** Valida y tipa `process.env` al arrancar; falla rápido con un mensaje claro. */
export function validarEntorno(config: Record<string, unknown>): VariablesEntorno {
  const validada = plainToInstance(VariablesEntorno, config, {
    enableImplicitConversion: true,
    exposeDefaultValues: true,
  });
  const errores = validateSync(validada, { skipMissingProperties: false });
  if (errores.length > 0) {
    const detalle = errores
      .map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('; ');
    throw new Error(`Configuración de entorno inválida → ${detalle}`);
  }
  return validada;
}
