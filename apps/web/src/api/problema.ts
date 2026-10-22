import { MENSAJES_CUENTA } from '@menu/shared';
import type { ErrorCampo } from './tipos';

/** Cuerpo `application/problem+json` (RFC 7807, api-contrato §1.4). */
export interface CuerpoProblema {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  codigo?: string;
  errores?: ErrorCampo[];
  [extension: string]: unknown;
}

/** Código interno cuando no hay red (CU-01.1 E1). */
export const SIN_CONEXION = 'SIN_CONEXION';

/** Error de la API con su `codigo` estable y el `detail` en español. */
export class ProblemaApi extends Error {
  readonly status: number;
  readonly codigo: string;
  readonly errores: ErrorCampo[];
  readonly cuerpo: CuerpoProblema;

  constructor(cuerpo: CuerpoProblema & { status: number }) {
    super(cuerpo.detail ?? cuerpo.title ?? `Error ${cuerpo.status}`);
    this.name = 'ProblemaApi';
    this.status = cuerpo.status;
    this.codigo = cuerpo.codigo ?? `HTTP_${cuerpo.status}`;
    this.errores = Array.isArray(cuerpo.errores) ? cuerpo.errores : [];
    this.cuerpo = cuerpo;
  }

  /** Mensaje del primer error del campo indicado, si lo hay. */
  errorDe(campo: string): string | undefined {
    return this.errores.find((e) => e.campo === campo)?.mensaje;
  }

  static sinConexion(): ProblemaApi {
    return new ProblemaApi({
      status: 0,
      codigo: SIN_CONEXION,
      detail: MENSAJES_CUENTA.sinConexion,
    });
  }

  /** Lee una respuesta de error; si el cuerpo no es JSON usa un mensaje genérico. */
  static async desde(respuesta: Response): Promise<ProblemaApi> {
    let cuerpo: CuerpoProblema = {};
    try {
      const leido: unknown = await respuesta.json();
      if (leido && typeof leido === 'object') cuerpo = leido as CuerpoProblema;
    } catch {
      // Cuerpo vacío o no JSON (p. ej. un proxy caído).
    }
    return new ProblemaApi({
      detail: 'Ocurrió un error inesperado. Intenta de nuevo más tarde.',
      ...cuerpo,
      status: respuesta.status,
    });
  }
}

/** Mensaje para mostrar al usuario a partir de cualquier error. */
export function mensajeDeError(error: unknown): string {
  if (error instanceof ProblemaApi) return error.message;
  return 'Ocurrió un error inesperado. Intenta de nuevo más tarde.';
}
