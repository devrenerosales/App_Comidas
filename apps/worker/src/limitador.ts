import type { Sitio } from './sitios.js';

export interface Reloj {
  ahora(): number;
  dormir(ms: number): Promise<void>;
}

export const relojReal: Reloj = {
  ahora: () => Date.now(),
  dormir: (ms) => new Promise((resolver) => setTimeout(resolver, ms)),
};

/**
 * Limitador por sitio (RNF-12): garantiza un intervalo mínimo entre el inicio de dos
 * solicitudes al mismo supermercado (por defecto 1 000 ms = 1 job/s). Sitios distintos
 * no se bloquean entre sí. Las llamadas concurrentes al mismo sitio se encolan.
 */
export class LimitadorPorSitio {
  private readonly proximoTurno = new Map<Sitio, number>();

  constructor(
    readonly intervaloMs = 1000,
    private readonly reloj: Reloj = relojReal,
  ) {
    if (!Number.isFinite(intervaloMs) || intervaloMs < 1000) {
      throw new RangeError('El intervalo mínimo por sitio es 1000 ms (RNF-12)');
    }
  }

  /** Reserva el siguiente turno del sitio y espera hasta que llegue. Devuelve la espera en ms. */
  async esperarTurno(sitio: Sitio): Promise<number> {
    const ahora = this.reloj.ahora();
    const turno = Math.max(ahora, this.proximoTurno.get(sitio) ?? 0);
    this.proximoTurno.set(sitio, turno + this.intervaloMs);
    const espera = turno - ahora;
    if (espera > 0) {
      await this.reloj.dormir(espera);
    }
    return espera;
  }
}
