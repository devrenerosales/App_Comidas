import { calcularIntentoFallido, estaBloqueada } from './bloqueo';

const AHORA = new Date('2026-10-22T15:00:00.000Z');
const minutos = (m: number) => new Date(AHORA.getTime() + m * 60_000);

describe('bloqueo por intentos fallidos (CU-01.1 8b)', () => {
  it('el primer fallo inicia la ventana', () => {
    expect(
      calcularIntentoFallido(
        { intentosFallidos: 0, primerIntentoFallidoEn: null, bloqueadoHasta: null },
        AHORA,
      ),
    ).toEqual({ intentosFallidos: 1, primerIntentoFallidoEn: AHORA, bloqueadoHasta: null });
  });

  it('suma fallos dentro de la ventana de 15 min', () => {
    const primero = minutos(-10);
    expect(
      calcularIntentoFallido(
        { intentosFallidos: 2, primerIntentoFallidoEn: primero, bloqueadoHasta: null },
        AHORA,
      ),
    ).toEqual({ intentosFallidos: 3, primerIntentoFallidoEn: primero, bloqueadoHasta: null });
  });

  it('CA-01.3 con 4 fallos en 15 min, el quinto bloquea 15 min y reinicia el conteo', () => {
    expect(
      calcularIntentoFallido(
        { intentosFallidos: 4, primerIntentoFallidoEn: minutos(-14), bloqueadoHasta: null },
        AHORA,
      ),
    ).toEqual({ intentosFallidos: 0, primerIntentoFallidoEn: null, bloqueadoHasta: minutos(15) });
  });

  it('fuera de la ventana el conteo vuelve a empezar', () => {
    expect(
      calcularIntentoFallido(
        { intentosFallidos: 4, primerIntentoFallidoEn: minutos(-15), bloqueadoHasta: null },
        AHORA,
      ),
    ).toEqual({ intentosFallidos: 1, primerIntentoFallidoEn: AHORA, bloqueadoHasta: null });
  });

  it('estaBloqueada compara con el instante actual', () => {
    expect(estaBloqueada({ bloqueadoHasta: null }, AHORA)).toBe(false);
    expect(estaBloqueada({ bloqueadoHasta: minutos(1) }, AHORA)).toBe(true);
    expect(estaBloqueada({ bloqueadoHasta: AHORA }, AHORA)).toBe(false);
  });
});
