/** Constantes de autenticación (ADR-004). */

/** Vigencia del token de acceso: 15 minutos. */
export const SEGUNDOS_TOKEN_ACCESO = 15 * 60;

/** Vigencia del refresh token: 30 días. */
export const DIAS_REFRESH = 30;
export const MS_REFRESH = DIAS_REFRESH * 24 * 60 * 60 * 1000;

/** Cookie del refresh en la PWA: HttpOnly, Secure, SameSite=Strict, solo en /api/v1/auth. */
export const COOKIE_REFRESH = 'mf_refresh';
export const RUTA_COOKIE_REFRESH = '/api/v1/auth';

/**
 * Cabecera con la que un cliente nativo (Android/Capacitor) pide el refresh en el cuerpo en
 * lugar de la cookie: `X-Cliente: android`.
 */
export const CABECERA_CLIENTE = 'x-cliente';
export const CLIENTES_NATIVOS: readonly string[] = ['android'];

/** Límite por defecto de /auth/* por IP y minuto (api-contrato §1.6). */
export const LIMITE_AUTH_POR_MINUTO = 10;
/** Nombre 'default': así la respuesta 429 usa la cabecera estándar `Retry-After`. */
export const THROTTLER_AUTH = 'default';

/** Metadato del decorador `@Publico()`. */
export const ES_PUBLICO = 'menu:esPublico';

/** Proveedor del reloj (permite fijar la hora en pruebas). */
export const RELOJ = Symbol('RELOJ');
export type Reloj = () => Date;
