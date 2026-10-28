import { SetMetadata } from '@nestjs/common';
import type { Rol } from '@menu/shared';

/** Metadato de `@Roles()`. */
export const ROLES_PERMITIDOS = 'menu:rolesPermitidos';

/**
 * Roles del hogar que pueden usar la ruta (RN-10). `ADMIN` hereda lo de `MIEMBRO`, así que
 * `@Roles('MIEMBRO')` también deja pasar al administrador. Requiere `HogarGuard` antes.
 */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_PERMITIDOS, roles);
