import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  LARGO_MAXIMO_CONTRASENA,
  LARGO_MAXIMO_CORREO,
  LARGO_MAXIMO_NOMBRE,
  normalizarCorreo,
} from '@menu/shared';
import { CumplePoliticaContrasena } from './politica-contrasena.validator';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const correoCanonico = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? normalizarCorreo(value) : value;

/** POST /auth/registro (RF-01 · HU-01). */
export class RegistroDto {
  @Transform(recortar)
  @IsString({ message: 'Ingresa tu nombre' })
  @IsNotEmpty({ message: 'Ingresa tu nombre' })
  @MaxLength(LARGO_MAXIMO_NOMBRE, {
    message: `El nombre admite hasta ${LARGO_MAXIMO_NOMBRE} caracteres`,
  })
  nombre!: string;

  @Transform(correoCanonico)
  @IsEmail({}, { message: 'Ingresa un correo válido' })
  @MaxLength(LARGO_MAXIMO_CORREO, { message: 'Ingresa un correo válido' })
  correo!: string;

  @IsString({ message: 'Ingresa una contraseña' })
  @CumplePoliticaContrasena()
  contrasena!: string;
}

/** POST /auth/login (RF-01 · HU-01). */
export class LoginDto {
  @Transform(correoCanonico)
  @IsString({ message: 'Ingresa tu correo' })
  @IsNotEmpty({ message: 'Ingresa tu correo' })
  @MaxLength(LARGO_MAXIMO_CORREO, { message: 'Ingresa un correo válido' })
  correo!: string;

  @IsString({ message: 'Ingresa tu contraseña' })
  @IsNotEmpty({ message: 'Ingresa tu contraseña' })
  @MaxLength(LARGO_MAXIMO_CONTRASENA, { message: 'Correo o contraseña incorrectos' })
  contrasena!: string;

  /** Nombre del dispositivo (opcional) para identificar la sesión. */
  @IsOptional()
  @IsString({ message: 'El dispositivo debe ser texto' })
  @MaxLength(120, { message: 'El dispositivo admite hasta 120 caracteres' })
  dispositivo?: string;
}

/**
 * POST /auth/refresh y /auth/logout. En la PWA el refresh viaja en la cookie HttpOnly y el
 * cuerpo puede ir vacío; Android lo envía aquí (ADR-004).
 */
export class RefreshDto {
  @IsOptional()
  @IsString({ message: 'El refresh token debe ser texto' })
  @MaxLength(200, { message: 'Refresh token no válido' })
  refreshToken?: string;
}
