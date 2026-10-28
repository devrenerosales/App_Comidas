import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';
import {
  LARGO_MAXIMO_CORREO,
  LARGO_MAXIMO_NOMBRE_HOGAR,
  MedioInvitacion,
  MENSAJES_HOGAR,
  normalizarCorreo,
} from '@menu/shared';
import type { ContextoValidacion } from '../../comun/validacion';

const NOMBRE_INVALIDO: ContextoValidacion = { codigo: 'NOMBRE_HOGAR_INVALIDO', status: 422 };
const CORREO_INVALIDO: ContextoValidacion = { codigo: 'CORREO_INVALIDO', status: 422 };

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;
const correoCanonico = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? normalizarCorreo(value) : value;

/** POST /hogares y PATCH /hogar (RF-02 · HU-02). Inválido → 422 `NOMBRE_HOGAR_INVALIDO`. */
export class NombreHogarDto {
  @Transform(recortar)
  @IsString({ message: MENSAJES_HOGAR.nombreObligatorio, context: NOMBRE_INVALIDO })
  @IsNotEmpty({ message: MENSAJES_HOGAR.nombreObligatorio, context: NOMBRE_INVALIDO })
  @MaxLength(LARGO_MAXIMO_NOMBRE_HOGAR, {
    message: `El nombre del hogar admite hasta ${LARGO_MAXIMO_NOMBRE_HOGAR} caracteres`,
    context: NOMBRE_INVALIDO,
  })
  nombre!: string;
}

/** POST /hogar/invitaciones (ADMIN): por correo exige `correo`; por enlace no lo admite. */
export class InvitarDto {
  @IsIn(Object.values(MedioInvitacion), { message: 'Elige invitar por CORREO o por ENLACE' })
  medio!: MedioInvitacion;

  @ValidateIf((dto: InvitarDto) => dto.medio === MedioInvitacion.CORREO || dto.correo !== undefined)
  @Transform(correoCanonico)
  @IsEmail({}, { message: 'Ingresa un correo válido', context: CORREO_INVALIDO })
  @MaxLength(LARGO_MAXIMO_CORREO, { message: 'Ingresa un correo válido', context: CORREO_INVALIDO })
  correo?: string;
}
