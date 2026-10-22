import { ValidateBy, type ValidationOptions } from 'class-validator';
import { cumplePoliticaContrasena, MENSAJE_POLITICA_CONTRASENA } from '@menu/shared';
import type { ContextoValidacion } from '../../comun/validacion';

const CONTEXTO: ContextoValidacion = { codigo: 'CONTRASENA_DEBIL', status: 422 };

/**
 * Política de contraseña de M01 (8+ caracteres, una letra y un número). Si es la única falla
 * la API responde 422 `CONTRASENA_DEBIL` con el mensaje de CA-01.4.
 */
export function CumplePoliticaContrasena(opciones: ValidationOptions = {}): PropertyDecorator {
  return ValidateBy(
    {
      name: 'cumplePoliticaContrasena',
      validator: {
        validate: (valor: unknown) => typeof valor === 'string' && cumplePoliticaContrasena(valor),
        defaultMessage: () => MENSAJE_POLITICA_CONTRASENA,
      },
    },
    { context: CONTEXTO, ...opciones },
  );
}
