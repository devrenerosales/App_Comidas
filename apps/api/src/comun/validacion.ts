import type { ValidationError } from 'class-validator';
import { Problema, type ErrorCampo } from './problema';

/**
 * Contexto que un decorador de class-validator puede declarar para que su error no sea un
 * 400 genérico sino un 422 con código propio (p. ej. `CONTRASENA_DEBIL`, api-contrato §2.1).
 */
export interface ContextoValidacion {
  codigo: string;
  status: 422;
}

const MENSAJE_CAMPO_NO_PERMITIDO = 'Este campo no está permitido';

interface Falla {
  campo: string;
  mensaje: string;
  contexto?: ContextoValidacion;
}

function aplanar(errores: ValidationError[], prefijo = ''): Falla[] {
  return errores.flatMap((e) => {
    const campo = prefijo ? `${prefijo}.${e.property}` : e.property;
    const propias = Object.entries(e.constraints ?? {}).map(([regla, mensaje]) => ({
      campo,
      mensaje: regla === 'whitelistValidation' ? MENSAJE_CAMPO_NO_PERMITIDO : mensaje,
      contexto: e.contexts?.[regla] as ContextoValidacion | undefined,
    }));
    return [...propias, ...aplanar(e.children ?? [], campo)];
  });
}

/**
 * `exceptionFactory` del ValidationPipe global: errores de DTO como RFC 7807.
 * - Si todas las fallas declaran el mismo contexto 422 → 422 con ese `codigo`.
 * - Si no → 400 `VALIDACION` con la lista `errores`.
 */
export function crearErrorValidacion(errores: ValidationError[]): Problema {
  const fallas = aplanar(errores);
  const lista: ErrorCampo[] = fallas.map(({ campo, mensaje }) => ({ campo, mensaje }));
  const primera = fallas[0];
  const codigo422 = primera?.contexto?.codigo;
  if (codigo422 && fallas.every((f) => f.contexto?.codigo === codigo422)) {
    return new Problema(422, codigo422, primera.mensaje, { errores: lista });
  }
  const detalle = primera?.mensaje ?? 'Revisa los datos enviados';
  return new Problema(400, 'VALIDACION', detalle, { errores: lista });
}
