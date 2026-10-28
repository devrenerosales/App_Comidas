/**
 * Reloj de la configuración (fecha de hoy en America/Guatemala para decidir qué menús son
 * futuros). Separado del `RELOJ` de autenticación para que las pruebas fijen el calendario sin
 * alterar la vigencia de los tokens.
 */
export const RELOJ_CONFIGURACION = Symbol('RELOJ_CONFIGURACION');
