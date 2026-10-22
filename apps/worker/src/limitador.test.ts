import { describe, expect, it, vi } from 'vitest';
import { LimitadorPorSitio, relojReal, type Reloj } from './limitador.js';

/** Reloj simulado: dormir() avanza el tiempo virtual. */
function relojFalso(inicio = 0): Reloj & { t: number; esperas: number[] } {
  const r = {
    t: inicio,
    esperas: [] as number[],
    ahora: () => r.t,
    dormir: async (ms: number) => {
      r.esperas.push(ms);
      r.t += ms;
    },
  };
  return r;
}

describe('LimitadorPorSitio (RNF-12: 1 job/s por sitio)', () => {
  it('la primera solicitud a un sitio no espera', async () => {
    const lim = new LimitadorPorSitio(1000, relojFalso());
    await expect(lim.esperarTurno('WALMART')).resolves.toBe(0);
  });

  it('dos solicitudes seguidas al mismo sitio quedan separadas 1000 ms', async () => {
    const reloj = relojFalso();
    const lim = new LimitadorPorSitio(1000, reloj);
    await lim.esperarTurno('WALMART');
    reloj.t += 200;
    await expect(lim.esperarTurno('WALMART')).resolves.toBe(800);
    expect(reloj.t).toBe(1000);
  });

  it('no espera si ya pasó el intervalo', async () => {
    const reloj = relojFalso();
    const lim = new LimitadorPorSitio(1000, reloj);
    await lim.esperarTurno('PAIZ');
    reloj.t += 1500;
    await expect(lim.esperarTurno('PAIZ')).resolves.toBe(0);
  });

  it('sitios distintos no se bloquean entre sí', async () => {
    const lim = new LimitadorPorSitio(1000, relojFalso());
    await lim.esperarTurno('WALMART');
    await expect(lim.esperarTurno('PAIZ')).resolves.toBe(0);
    await expect(lim.esperarTurno('LA_TORRE')).resolves.toBe(0);
  });

  it('las llamadas concurrentes al mismo sitio se escalonan a 0, 1000, 2000 ms', async () => {
    const lim = new LimitadorPorSitio(1000, { ahora: () => 0, dormir: async () => undefined });
    const esperas = await Promise.all([
      lim.esperarTurno('WALMART'),
      lim.esperarTurno('WALMART'),
      lim.esperarTurno('WALMART'),
    ]);
    expect(esperas).toEqual([0, 1000, 2000]);
  });

  it.each([0, 500, Number.NaN])('rechaza intervalos menores a 1000 ms (%s)', (ms) => {
    expect(() => new LimitadorPorSitio(ms)).toThrow(RangeError);
  });

  it('usa el reloj real por defecto', async () => {
    vi.useFakeTimers();
    const lim = new LimitadorPorSitio();
    expect(lim.intervaloMs).toBe(1000);
    await lim.esperarTurno('WALMART');
    const segunda = lim.esperarTurno('WALMART');
    await vi.advanceTimersByTimeAsync(1000);
    await expect(segunda).resolves.toBeGreaterThan(0);
    vi.useRealTimers();
  });

  it('relojReal.ahora devuelve la hora actual', () => {
    expect(Math.abs(relojReal.ahora() - Date.now())).toBeLessThan(50);
  });
});
