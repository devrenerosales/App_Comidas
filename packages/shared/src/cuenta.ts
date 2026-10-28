/**
 * Reglas de cuenta compartidas por la API y la app (M01 · CU-01.1 · RF-01).
 * Supuesto de M01: contraseña de mínimo 8 caracteres con al menos una letra y un número.
 */

/** Largo mínimo de la contraseña (supuesto de M01, RNF-05). */
export const LARGO_MINIMO_CONTRASENA = 8;

/** Largo máximo aceptado: evita hashes costosos con entradas enormes. */
export const LARGO_MAXIMO_CONTRASENA = 128;

/** Largo máximo del nombre del usuario (columna `usuario.nombre`). */
export const LARGO_MAXIMO_NOMBRE = 80;

/** Largo máximo del correo (columna `usuario.correo`, RFC 5321). */
export const LARGO_MAXIMO_CORREO = 254;

/** Texto del criterio CA-01.4. */
export const MENSAJE_POLITICA_CONTRASENA =
  'La contraseña debe tener al menos 8 caracteres, una letra y un número';

/** Bloqueo anti fuerza bruta (CU-01.1 8b, ADR-004). */
export const INTENTOS_MAXIMOS_LOGIN = 5;
export const VENTANA_INTENTOS_MINUTOS = 15;
export const MINUTOS_BLOQUEO = 15;

/** Mensajes en español de los criterios de aceptación de HU-01. */
export const MENSAJES_CUENTA = {
  correoRegistrado: 'Este correo ya tiene cuenta',
  credencialesInvalidas: 'Correo o contraseña incorrectos',
  cuentaBloqueada:
    'Por seguridad, el inicio de sesión de esta cuenta está bloqueado 15 minutos. Intenta más tarde.',
  sinConexion: 'Necesitas conexión para iniciar sesión',
  sesionTerminada: 'Tu sesión terminó. Inicia sesión de nuevo.',
} as const;

/** `true` si la contraseña cumple la política (8–128 caracteres, al menos una letra y un número). */
export function cumplePoliticaContrasena(contrasena: string): boolean {
  return (
    contrasena.length >= LARGO_MINIMO_CONTRASENA &&
    contrasena.length <= LARGO_MAXIMO_CONTRASENA &&
    /\p{L}/u.test(contrasena) &&
    /\p{Nd}/u.test(contrasena)
  );
}

/** Correo canónico: sin espacios alrededor y en minúsculas (único global, RF-01). */
export function normalizarCorreo(correo: string): string {
  return correo.trim().toLowerCase();
}
