import { INTENTOS_MAXIMOS_LOGIN, MINUTOS_BLOQUEO, VENTANA_INTENTOS_MINUTOS } from '@menu/shared';

/** Estado anti fuerza bruta de un usuario (columnas de `usuario`). */
export interface EstadoIntentos {
  intentosFallidos: number;
  primerIntentoFallidoEn: Date | null;
  bloqueadoHasta: Date | null;
}

const MINUTO = 60_000;

/** `true` si la cuenta está bloqueada en el instante `ahora`. */
export function estaBloqueada(
  estado: Pick<EstadoIntentos, 'bloqueadoHasta'>,
  ahora: Date,
): boolean {
  return estado.bloqueadoHasta !== null && estado.bloqueadoHasta.getTime() > ahora.getTime();
}

/**
 * Registra un intento fallido (CU-01.1 8b): cuenta los fallos dentro de una ventana de 15 min
 * desde el primero; al llegar a 5 bloquea el inicio de sesión 15 min y reinicia el conteo.
 */
export function calcularIntentoFallido(estado: EstadoIntentos, ahora: Date): EstadoIntentos {
  const ventanaVigente =
    estado.primerIntentoFallidoEn !== null &&
    ahora.getTime() - estado.primerIntentoFallidoEn.getTime() < VENTANA_INTENTOS_MINUTOS * MINUTO;
  const intentos = ventanaVigente ? estado.intentosFallidos + 1 : 1;
  const primero = ventanaVigente ? estado.primerIntentoFallidoEn : ahora;
  if (intentos >= INTENTOS_MAXIMOS_LOGIN) {
    return {
      intentosFallidos: 0,
      primerIntentoFallidoEn: null,
      bloqueadoHasta: new Date(ahora.getTime() + MINUTOS_BLOQUEO * MINUTO),
    };
  }
  return { intentosFallidos: intentos, primerIntentoFallidoEn: primero, bloqueadoHasta: null };
}
