import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { HogarDelUsuario, RequestConHogar } from '../hogar.tipos';

/** Extrae el hogar que dejó `HogarGuard` (o uno de sus campos). */
export function extraerHogarActual(
  campo: keyof HogarDelUsuario | undefined,
  ctx: ExecutionContext,
): HogarDelUsuario | HogarDelUsuario[keyof HogarDelUsuario] | undefined {
  const hogar = ctx.switchToHttp().getRequest<RequestConHogar>().hogar;
  return campo ? hogar?.[campo] : hogar;
}

/**
 * `@HogarActual()` → `{ hogarId, rol }`; `@HogarActual('hogarId')` → solo el id. Siempre sale de
 * la base para el usuario del token, nunca de la URL ni del cuerpo (RNF-06).
 */
export const HogarActual = createParamDecorator(extraerHogarActual);
