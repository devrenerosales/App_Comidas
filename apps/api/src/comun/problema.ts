import { HttpException, HttpStatus } from '@nestjs/common';

/** Error de un campo (RFC 7807 extendido, api-contrato.md §1.4). */
export interface ErrorCampo {
  campo: string;
  mensaje: string;
}

/** Cuerpo `application/problem+json` de todas las respuestas de error. */
export interface CuerpoProblema {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  codigo: string;
  errores?: ErrorCampo[];
  [extension: string]: unknown;
}

export const TIPO_CONTENIDO_PROBLEMA = 'application/problem+json';
const BASE_TIPO = 'https://menufamiliar.local/problemas/';

/** Títulos en español por código HTTP. */
export const TITULOS_HTTP: Readonly<Record<number, string>> = {
  400: 'Solicitud no válida',
  401: 'No autorizado',
  403: 'Acceso denegado',
  404: 'No encontrado',
  409: 'Conflicto',
  422: 'Datos no válidos',
  423: 'Bloqueado temporalmente',
  429: 'Demasiadas solicitudes',
  500: 'Error interno',
};

/** Código estable por defecto cuando la excepción no trae uno propio. */
export const CODIGOS_HTTP: Readonly<Record<number, string>> = {
  400: 'SOLICITUD_INVALIDA',
  401: 'NO_AUTENTICADO',
  403: 'ACCESO_DENEGADO',
  404: 'NO_ENCONTRADO',
  405: 'METODO_NO_PERMITIDO',
  409: 'CONFLICTO',
  413: 'CUERPO_DEMASIADO_GRANDE',
  415: 'TIPO_NO_SOPORTADO',
  422: 'VALIDACION',
  423: 'BLOQUEADO',
  429: 'LIMITE_SOLICITUDES',
  500: 'ERROR_INTERNO',
};

/** URI del tipo de problema derivada del código: `CUENTA_BLOQUEADA` → `…/cuenta-bloqueada`. */
export function tipoProblema(codigo: string): string {
  return BASE_TIPO + codigo.toLowerCase().replace(/_/g, '-');
}

/** Arma el cuerpo RFC 7807 completo. */
export function cuerpoProblema(
  status: number,
  codigo: string,
  detail: string,
  extensiones: Record<string, unknown> = {},
): CuerpoProblema {
  return {
    type: tipoProblema(codigo),
    title: TITULOS_HTTP[status] ?? 'Error',
    status,
    detail,
    codigo,
    ...extensiones,
  };
}

/**
 * Excepción de negocio con código estable (`codigo`) y mensaje en español (`detail`).
 * Ej.: `throw new Problema(409, 'CORREO_REGISTRADO', 'Este correo ya tiene cuenta')`.
 */
export class Problema extends HttpException {
  constructor(
    status: HttpStatus | number,
    readonly codigo: string,
    readonly detalle: string,
    readonly extensiones: Record<string, unknown> = {},
  ) {
    super(cuerpoProblema(status, codigo, detalle, extensiones), status);
  }
}
