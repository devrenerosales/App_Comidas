import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UsuarioAutenticado } from '../auth.tipos';

/** Extrae el usuario autenticado (o uno de sus campos) que dejó el `JwtAuthGuard`. */
export function extraerUsuarioActual(
  campo: keyof UsuarioAutenticado | undefined,
  ctx: ExecutionContext,
): UsuarioAutenticado | UsuarioAutenticado[keyof UsuarioAutenticado] | undefined {
  const usuario = ctx.switchToHttp().getRequest<{ usuario?: UsuarioAutenticado }>().usuario;
  return campo ? usuario?.[campo] : usuario;
}

/** `@UsuarioActual()` → `UsuarioAutenticado`; `@UsuarioActual('id')` → solo el id. */
export const UsuarioActual = createParamDecorator(extraerUsuarioActual);
