import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  ValidateIf,
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

  /** Solicitudes por minuto e IP a /auth/* (api-contrato §1.6). */
  @IsInt()
  @Min(1)
  AUTH_LIMITE_POR_MINUTO: number = 10;

  /** Uno o varios orígenes separados por coma. */
  @IsString()
  CORS_ORIGIN: string = 'http://localhost:5173';

  /**
   * URL pública de la app: base de los enlaces de invitación y recuperación (`APP_URL/invitacion/…`).
   */
  @IsUrl({ require_tld: false, protocols: ['http', 'https'], require_protocol: true })
  APP_URL: string = 'http://localhost:5173';

  /**
   * Correo SMTP (D-13: Gmail con contraseña de aplicación, STARTTLS en 587). Vacío o sin definir:
   * los correos se guardan en memoria y se registran en el log (desarrollo y pruebas).
   */
  @IsOptional()
  @IsString()
  SMTP_HOST?: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  SMTP_PORT: number = 587;

  /** Usuario y contraseña de aplicación: obligatorios si hay `SMTP_HOST`. */
  @ValidateIf((env: VariablesEntorno) => Boolean(env.SMTP_HOST))
  @IsString()
  @MinLength(1, { message: 'SMTP_USER es obligatorio cuando se define SMTP_HOST' })
  SMTP_USER?: string;

  @ValidateIf((env: VariablesEntorno) => Boolean(env.SMTP_HOST))
  @IsString()
  @MinLength(1, { message: 'SMTP_PASS es obligatorio cuando se define SMTP_HOST' })
  SMTP_PASS?: string;

  /** Remitente, p. ej. `"Menú Familiar <cuenta@gmail.com>"`. */
  @ValidateIf((env: VariablesEntorno) => Boolean(env.SMTP_HOST))
  @IsString()
  @MinLength(3, { message: 'SMTP_FROM es obligatorio cuando se define SMTP_HOST' })
  SMTP_FROM?: string;

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
