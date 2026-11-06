import { ZONA_HORARIA } from './red.js';

export const COLA_CORRIDA = 'precios-corrida';
export const COLA_RECALCULO = 'precios-recalculo';

/** Sábado y domingo a las 21:00 (CU-09.1): `0 21 * * 6,0` en la zona de Guatemala. */
export const PROGRAMACION_CORRIDA = '0 21 * * 6,0';
export const ID_PROGRAMADOR_CORRIDA = 'corrida-fin-de-semana';

interface ColaProgramable {
  upsertJobScheduler(
    id: string,
    repeat: { pattern: string; tz: string },
    plantilla: { name: string },
  ): Promise<unknown>;
}

/**
 * Registra (o actualiza) la programación de la corrida de fin de semana. Es idempotente: cada
 * arranque del worker vuelve a llamarla sin duplicar la programación.
 */
export function programarCorrida(cola: ColaProgramable): Promise<unknown> {
  return cola.upsertJobScheduler(
    ID_PROGRAMADOR_CORRIDA,
    { pattern: PROGRAMACION_CORRIDA, tz: ZONA_HORARIA },
    { name: 'corrida' },
  );
}
